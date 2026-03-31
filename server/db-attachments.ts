import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  attachments,
  formTemplates,
  dailyFieldReports,
  concreteTests,
  InsertAttachment,
  InsertFormTemplate,
  Attachment,
  FormTemplate,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import * as appDb from "./db";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ Attachments ============

export async function createAttachment(attachment: InsertAttachment): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create attachment: database not available");
    return;
  }

  try {
    await db.insert(attachments).values(attachment);
  } catch (error) {
    console.error("[Database] Failed to create attachment:", error);
    throw error;
  }
}

export async function getAttachmentsByFormId(
  formType: "daily" | "concrete",
  formId: number
): Promise<Attachment[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get attachments: database not available");
    return [];
  }

  try {
    return await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.formType, formType), eq(attachments.formId, formId)));
  } catch (error) {
    console.error("[Database] Failed to get attachments:", error);
    return [];
  }
}

export async function getAttachmentById(attachmentId: number): Promise<Attachment | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get attachment: database not available");
    return null;
  }

  try {
    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get attachment:", error);
    return null;
  }
}

export async function deleteAttachment(attachmentId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete attachment: database not available");
    return;
  }

  try {
    await db.delete(attachments).where(eq(attachments.id, attachmentId));
  } catch (error) {
    console.error("[Database] Failed to delete attachment:", error);
    throw error;
  }
}

// ============ Form Templates ============

export async function createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create template: database not available");
    return null;
  }

  try {
    const result = await db.insert(formTemplates).values(template);
    const created = await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.id, (result as any).insertId))
      .limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create template:", error);
    throw error;
  }
}

export async function getFormTemplatesByType(formType: "daily" | "concrete"): Promise<FormTemplate[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get templates: database not available");
    return [];
  }

  try {
    return await db
      .select()
      .from(formTemplates)
      .where(and(eq(formTemplates.formType, formType), eq(formTemplates.isActive, true)));
  } catch (error) {
    console.error("[Database] Failed to get templates:", error);
    return [];
  }
}

export async function getFormTemplateById(templateId: number): Promise<FormTemplate | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get template: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.id, templateId))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get template:", error);
    return null;
  }
}

export async function updateFormTemplate(
  templateId: number,
  updates: Partial<InsertFormTemplate>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update template: database not available");
    return;
  }

  try {
    await db.update(formTemplates).set(updates).where(eq(formTemplates.id, templateId));
  } catch (error) {
    console.error("[Database] Failed to update template:", error);
    throw error;
  }
}

export async function deleteFormTemplate(templateId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete template: database not available");
    return;
  }

  try {
    await db.delete(formTemplates).where(eq(formTemplates.id, templateId));
  } catch (error) {
    console.error("[Database] Failed to delete template:", error);
    throw error;
  }
}

// ============ Analytics Queries ============

export type AnalyticsFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: "all" | "pending" | "approved" | "rejected" | null;
};

export type AnalyticsGroupBy = "day" | "week" | "month";

type SubmissionRecord = {
  userId?: number | null;
  status?: string | null;
  createdAt?: string | Date | null;
};

async function getSubmissionRows(formType: "daily" | "concrete"): Promise<any[]> {
  if (formType === "daily") {
    return await appDb.getAllDailyFieldReports();
  }

  return await appDb.getAllConcreteTests();
}

async function getFilteredSubmissionRows(
  formType: "daily" | "concrete",
  filters?: AnalyticsFilters
): Promise<any[]> {
  const rows = await getSubmissionRows(formType);
  return filterSubmissionRecords(rows as SubmissionRecord[], filters);
}

function isWithinDateRange(value: string | Date | null | undefined, filters?: AnalyticsFilters) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return false;

  if (filters?.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00`);
    if (!Number.isNaN(from.getTime()) && date < from) return false;
  }

  if (filters?.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`);
    if (!Number.isNaN(to.getTime()) && date > to) return false;
  }

  return true;
}

function filterSubmissionRecords<T extends SubmissionRecord>(rows: T[], filters?: AnalyticsFilters) {
  return rows.filter((row) => {
    const matchesStatus =
      !filters?.status ||
      filters.status === "all" ||
      row.status === filters.status;

    const matchesDate =
      (!filters?.dateFrom && !filters?.dateTo) ||
      isWithinDateRange(row.createdAt, filters);

    return matchesStatus && matchesDate;
  });
}

function startOfWeek(input: Date) {
  const date = new Date(input);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toGroupKey(value: string | Date | null | undefined, groupBy: AnalyticsGroupBy) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  if (groupBy === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  if (groupBy === "week") {
    return startOfWeek(date).toISOString().split("T")[0];
  }

  return date.toISOString().split("T")[0];
}

export async function getSubmissionStats(formType: "daily" | "concrete"): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  try {
    const all = await getSubmissionRows(formType);

    return {
      total: all.length,
      pending:  all.filter((r: any) => r.status === "pending").length,
      approved: all.filter((r: any) => r.status === "approved").length,
      rejected: all.filter((r: any) => r.status === "rejected").length,
    };
  } catch (error) {
    console.error("[Database] Failed to get submission stats:", error);
    return { total: 0, pending: 0, approved: 0, rejected: 0 };
  }
}

export async function getSubmissionStatsFiltered(
  formType: "daily" | "concrete",
  filters?: AnalyticsFilters
): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  try {
    const filtered = await getFilteredSubmissionRows(formType, filters);

    return {
      total: filtered.length,
      pending: filtered.filter((r: any) => r.status === "pending").length,
      approved: filtered.filter((r: any) => r.status === "approved").length,
      rejected: filtered.filter((r: any) => r.status === "rejected").length,
    };
  } catch (error) {
    console.error("[Analytics] Failed to get filtered submission stats:", error);
    return { total: 0, pending: 0, approved: 0, rejected: 0 };
  }
}

/**
 * Returns average specifiedStrengthPsi grouped by MEI project name.
 * averageStrength was removed from the schema — specimen-level strength data
 * now lives inside the `specimens` JSON column on each concrete test.
 */
export async function getAverageConcreteStrengthByProject(filters?: AnalyticsFilters): Promise<
  Array<{ projectName: string; avgStrength: number; submissionCount: number }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { concreteTests } = await import("../drizzle/schema");
    const all = await db.select().from(concreteTests);
    const filtered = filterSubmissionRecords(all as SubmissionRecord[], filters);

    const grouped: Record<string, number[]> = {};
    filtered.forEach((test: any) => {
      const key = test.meiProjectNoName as string;
      if (!grouped[key]) grouped[key] = [];
      if (test.specifiedStrengthPsi != null) {
        grouped[key].push(Number(test.specifiedStrengthPsi));
      }
    });

    return Object.entries(grouped)
      .map(([projectName, values]) => ({
        projectName,
        avgStrength: values.length
          ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
          : 0,
        submissionCount: values.length,
      }))
      .sort((a, b) => b.avgStrength - a.avgStrength);
  } catch (error) {
    console.error("[Analytics] Failed to get average strengths:", error);
    return [];
  }
}

export async function getSubmissionsByDate(
  formType: "daily" | "concrete",
  filters?: AnalyticsFilters,
  groupBy: AnalyticsGroupBy = "day"
): Promise<Array<{ date: string; count: number }>> {
  try {
    const filtered = await getFilteredSubmissionRows(formType, filters);

    const grouped: Record<string, number> = {};
    filtered.forEach((form: any) => {
      const dateKey = toGroupKey(form.createdAt, groupBy);
      if (!dateKey) return;
      grouped[dateKey] = (grouped[dateKey] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("[Analytics] Failed to get submissions by date:", error);
    return [];
  }
}

export async function getInspectorStats(): Promise<
  Array<{ inspectorName: string; submissionCount: number; approvalRate: number }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { users } = await import("../drizzle/schema");
    const allUsers       = await db.select().from(users).where(eq(users.role, "user"));
    const dailyReports   = await getSubmissionRows("daily");
    const concreteData   = await getSubmissionRows("concrete");

    return allUsers.map((user: any) => {
      const userDaily    = dailyReports.filter((r: any) => r.userId === user.id);
      const userConcrete = concreteData.filter((t: any) => t.userId === user.id);
      const total        = userDaily.length + userConcrete.length;
      const approved     =
        userDaily.filter((r: any)    => r.status === "approved").length +
        userConcrete.filter((t: any) => t.status === "approved").length;

      return {
        inspectorName:   user.name || user.email,
        submissionCount: total,
        approvalRate:    total > 0 ? Math.round((approved / total) * 100) : 0,
      };
    });
  } catch (error) {
    console.error("[Database] Failed to get inspector stats:", error);
    return [];
  }
}

export async function getInspectorStatsFiltered(filters?: AnalyticsFilters): Promise<
  Array<{ inspectorName: string; submissionCount: number; approvalRate: number }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { users } = await import("../drizzle/schema");
    const allUsers = await db.select().from(users).where(eq(users.role, "user"));
    const dailyReports = await getFilteredSubmissionRows("daily", filters);
    const concreteData = await getFilteredSubmissionRows("concrete", filters);

    return allUsers
      .map((user: any) => {
        const userDaily = dailyReports.filter((r: any) => r.userId === user.id);
        const userConcrete = concreteData.filter((t: any) => t.userId === user.id);
        const total = userDaily.length + userConcrete.length;
        const approved =
          userDaily.filter((r: any) => r.status === "approved").length +
          userConcrete.filter((t: any) => t.status === "approved").length;

        return {
          inspectorName: user.name || user.email,
          submissionCount: total,
          approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        };
      })
      .filter((inspector) => inspector.submissionCount > 0)
      .sort((a, b) => b.submissionCount - a.submissionCount);
  } catch (error) {
    console.error("[Analytics] Failed to get filtered inspector stats:", error);
    return [];
  }
}
