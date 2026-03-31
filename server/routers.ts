import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { generateDailyReportPDF, generateConcreteTestPDF } from "./pdf";
import fs from "fs";
import path from "path";
import {
  notifyAdminDailyReportSubmitted,
  notifyAdminConcreteTestSubmitted,
  notifyEmployeeDailyReportApproved,
  notifyEmployeeDailyReportRejected,
  notifyEmployeeConcreteTestApproved,
  notifyEmployeeConcreteTestRejected,
} from "./notifications";
import {
  getSuggestedInspectionTypes,
  getSuggestedContractors,
  getSuggestedClients,
  getAverageConcreteStrength,
  getSuggestedMixDesigns,
} from "./suggestions";
import { attachmentRouter, templateRouter, analyticsRouter } from "./routers-extended";
import { usersRouter } from "./routers-users";
import { notificationsRouter } from "./routers-notifications";
import { sdk } from "./_core/sdk";
import { verifyPassword } from "./auth-utils";
import { normalizeInspectionTypes } from "@shared/inspection-types";
import { getAdminRecipients } from "./db-notifications";

// ── Specimen schema ───────────────────────────────────────────────────────────
const specimenSchema = z.object({
  specimenNo: z.string(),
  setNo: z.string(),
  agedDays: z.string(),
  dateTested: z.string(),
  dimensions: z.string(),
  areaSquareIn: z.string(),
  ultimateLoadLbs: z.string(),
  compressiveStrengthPsi: z.string(),
  averageStrengthPsi: z.string(),
  labTechnician: z.string(),
  labManager: z.string(),
});

const SPECIMEN_REQUIRED_FIELDS: Array<keyof z.infer<typeof specimenSchema>> = [
  "specimenNo",
  "setNo",
  "agedDays",
  "dateTested",
  "dimensions",
  "areaSquareIn",
  "ultimateLoadLbs",
  "compressiveStrengthPsi",
  "averageStrengthPsi",
  "labTechnician",
  "labManager",
];

function normalizeSpecimenRow(row: z.infer<typeof specimenSchema>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])
  ) as z.infer<typeof specimenSchema>;
}

function isBlankSpecimen(row: z.infer<typeof specimenSchema>) {
  return SPECIMEN_REQUIRED_FIELDS.every((field) => !row[field]);
}

function validateConcreteSpecimens(
  specimens: z.infer<typeof specimenSchema>[],
  ctx: z.RefinementCtx
) {
  specimens.forEach((row, index) => {
    const normalized = normalizeSpecimenRow(row);
    const blank = isBlankSpecimen(normalized);

    if (index === 0 || !blank) {
      for (const field of SPECIMEN_REQUIRED_FIELDS) {
        if (!normalized[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Required",
            path: [index, field],
          });
        }
      }
    }
  });
}

function validateDecimalString(
  value: string | null | undefined,
  maxIntegerDigits: number,
  maxFractionDigits: number
) {
  if (value == null || value === "") return true;
  const trimmed = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
  const normalized = trimmed.replace(/^-/, "");
  const [integerPart, fractionPart = ""] = normalized.split(".");
  return integerPart.length <= maxIntegerDigits && fractionPart.length <= maxFractionDigits;
}

function validateIntString(value: string | number | null | undefined) {
  if (value == null || value === "") return true;
  return /^-?\d+$/.test(String(value).trim());
}

async function dispatchNotificationSafely(
  label: string,
  send: () => Promise<boolean>
): Promise<void> {
  try {
    const delivered = await send();
    if (!delivered) {
      console.warn(`[Notification] ${label} was skipped or could not be delivered.`);
    }
  } catch (error) {
    console.warn(`[Notification] ${label} failed unexpectedly:`, error);
  }
}

// ── Daily Field Report schema ─────────────────────────────────────────────────
const dailyFieldReportSchema = z.object({
  // Job Information
  jobNo: z.string().min(1, "Job number is required"),
  permitNo: z.string().min(1, "Permit number is required"),
  projectName: z.string().min(1, "Project name is required"),
  client: z.string().min(1, "Client name is required"),
  location: z.string().min(1, "Location is required"),
  contractor: z.string().min(1, "Contractor name is required"),

  // Date, Time & Weather
  date: z.union([z.date(), z.string()])
    .refine((v) => {
      const d = v instanceof Date ? v : new Date(v);
      return !Number.isNaN(d.getTime());
    }, "A valid date is required")
    .transform((v) => {
      const d = v instanceof Date ? v : new Date(v);
      return d.toISOString().slice(0, 19).replace("T", " ");
    }),
  time: z.string().optional().nullable(),
  weather: z.string().optional().nullable(),

  // Inspection Types
  inspectionTypes: z.array(z.string())
    .transform((values) => normalizeInspectionTypes(values))
    .refine((values) => values.length > 0, "At least one inspection type is required"),

  // Conformance
  workConformance: z.enum(["met", "not_met"]),
  workRequirements: z.enum(["met", "not_met"]),
  materialSampling: z.enum(["performed", "not_performed"]),

  // Notes
  notes: z.string().optional().nullable(),
});

// ── Concrete Test schema ──────────────────────────────────────────────────────
const concreteTestSchema = z.object({
  // Project Information
  permitNo: z.string().min(1, "Permit number is required"),
  fileNo: z.string().optional().nullable(),
  meiProjectNoName: z.string().min(1, "MEI Project No. & Name is required"),
  contractor: z.string().min(1, "Contractor name is required"),
  subContractor: z.string().optional().nullable(),
  buildingNo: z.string().optional().nullable(),
  floorDeck: z.string().optional().nullable(),
  other: z.string().optional().nullable(),
  specificLocation: z.string().optional().nullable(),

  // Placement Type
  footing: z.boolean().default(false),
  postTension: z.boolean().default(false),
  masonryWall: z.boolean().default(false),
  columns: z.boolean().default(false),
  walls: z.boolean().default(false),
  masonryColumns: z.boolean().default(false),
  slabOnGrade: z.boolean().default(false),
  beams: z.boolean().default(false),
  masonryPrisms: z.boolean().default(false),

  // Sample Information
  supplier: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  sampledBy: z.string().optional().nullable(),
  ticketNo: z.string().optional().nullable(),
  dateSampled: z.union([z.date(), z.string()]).optional().nullable().transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return d.toISOString().slice(0, 19).replace("T", " ");
  }),
  time: z.string().optional().nullable(),
  loadNo: z.string().optional().nullable(),
  dateReceived: z.union([z.date(), z.string()]).optional().nullable().transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return d.toISOString().slice(0, 19).replace("T", " ");
  }),
  setNo: z.string().optional().nullable(),
  truckNo: z.string().optional().nullable(),
  weather: z.string().optional().nullable(),
  mixDesignNo: z.string().optional().nullable(),
  cementFactorSkCy: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 7, 3),
    "Must be a valid number with up to 7 digits and 3 decimals"
  ),
  maxSizeAggIn: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 7, 3),
    "Must be a valid number with up to 7 digits and 3 decimals"
  ),
  admixture: z.string().optional().nullable(),
  specifiedStrengthPsi: z.union([z.string(), z.number()]).optional().nullable().transform((v) =>
    v === "" || v == null ? null : Number(v)
  ).refine((v) => validateIntString(v), "Must be a whole number"),

  // Specified vs Measured
  slumpInSpecified: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  slumpInMeasured: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  mixTempFSpecified: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  mixTempFMeasured: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  airTempFSpecified: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  airTempFMeasured: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  airContentSpecified: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),
  airContentMeasured: z.string().optional().nullable().refine(
    (v) => validateDecimalString(v, 4, 2),
    "Must be a valid number up to 9999.99"
  ),

  // Specimens
  specimens: z.array(specimenSchema)
    .min(1, "At least one specimen is required")
    .max(7, "Up to 7 specimens are supported")
    .transform((rows) => rows.map(normalizeSpecimenRow))
    .superRefine(validateConcreteSpecimens)
    .transform((rows) => rows.filter((row, index) => index === 0 || !isBlankSpecimen(row))),

  // Comments
  comments: z.string().optional().nullable(),
});

const approvalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comments: z.string().optional(),
});

// ── App Router ────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return { success: true } as const;
    }),
    // Local login for development (no OAuth required)
    localLogin: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        let user = await db.getUserByEmail(input.email);
        const openId = `local-${input.email}`;

        if (!user) {
          const allUsers = await db.getAllUsers();
          const isFirstUser = allUsers.length === 0;

          await db.upsertUser({
            openId,
            email: input.email,
            name: input.email.split("@")[0],
            loginMethod: "local",
            role: isFirstUser ? "admin" : "user",
            lastSignedIn: new Date(),
          });

          user = await db.getUserByEmail(input.email);
          if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.email,
        });

        const cookieOptions = { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS };
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return { success: true, userId: user.id };
      }),
    // Username/password login
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByUsername(input.username);

        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }

        if (!user.isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Account is deactivated" });
        }

        const passwordValid = await verifyPassword(input.password, user.passwordHash);
        if (!passwordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.username || "User",
        });

        const cookieOptions = { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS };
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        await db.upsertUser({
          openId: user.openId,
          email: user.email,
          lastSignedIn: new Date(),
        });

        return { success: true, userId: user.id, role: user.role };
      }),
  }),

  // ── Daily Field Reports ─────────────────────────────────────────────────────
  dailyReport: router({
    create: protectedProcedure
      .input(dailyFieldReportSchema)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot submit forms" });
        }

        console.log("[DEBUG] About to insert daily report with data:", JSON.stringify({
          userId: ctx.user.id,
          date: input.date,
          weather: input.weather,
          notes: input.notes,
        }, null, 2));
        const result = await db.createDailyFieldReport({
          userId: ctx.user.id,
          jobNo: input.jobNo,
          permitNo: input.permitNo,
          projectName: input.projectName,
          client: input.client,
          location: input.location,
          contractor: input.contractor,
          date: input.date,
          time: input.time ?? null,
          weather: input.weather ?? null,
          inspectionTypes: input.inspectionTypes,
          workConformance: input.workConformance,
          workRequirements: input.workRequirements,
          materialSampling: input.materialSampling,
          notes: input.notes || null,
          status: "pending",
        });

        const formId = result?.id || 0;

        const adminRecipients = await getAdminRecipients();
        await dispatchNotificationSafely("daily report submitted", () =>
          notifyAdminDailyReportSubmitted(
            { ...input, userId: ctx.user.id, id: formId, status: "pending", createdAt: new Date(), updatedAt: new Date() } as any,
            ctx.user,
            adminRecipients
          )
        );

        return { success: true, id: formId };
      }),

    edit: protectedProcedure
      .input(z.object({ id: z.number() }).merge(dailyFieldReportSchema))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const report = await db.getDailyFieldReportById(id);

        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
        if (ctx.user.role !== "admin" && report.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit other users' reports" });
        }

        await db.updateDailyFieldReport(id, {
          ...data,
          weather: data.weather ?? null,
          time: data.time ?? null,
          notes: data.notes || null,
        });
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const report = await db.getDailyFieldReportById(input);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
        const employee = await db.getUserById(report.userId);
        return { ...report, employeeName: employee?.name || "Unknown" };
      }),

    getUserReports: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot view personal submissions" });
        }
        return await db.getDailyFieldReportsByUserId(ctx.user.id);
      }),

    getAllReports: adminProcedure
      .query(async () => {
        return await db.getAllDailyFieldReports();
      }),

    updateStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["pending", "approved", "rejected"]) }))
      .mutation(async ({ input }) => {
        await db.updateDailyFieldReportStatus(input.id, input.status);
        return { success: true };
      }),

    downloadPDF: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const report = await db.getDailyFieldReportById(input);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });

        // Prevent exporting legacy/incomplete records with missing required daily fields.
        const missingRequired = [
          ["jobNo", report.jobNo],
          ["permitNo", report.permitNo],
          ["projectName", report.projectName],
          ["client", report.client],
          ["location", report.location],
          ["contractor", report.contractor],
          ["date", report.date],
          ["inspectionTypes", report.inspectionTypes],
          ["workConformance", report.workConformance],
          ["workRequirements", (report as typeof report & { workRequirements?: string | null }).workRequirements],
          ["materialSampling", report.materialSampling],
        ].filter(([, value]) => {
          if (Array.isArray(value)) return value.length === 0;
          return value == null || String(value).trim() === "";
        });

        if (missingRequired.length > 0) {
          const fields = missingRequired.map(([name]) => name).join(", ");
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot export PDF: report is missing required fields (${fields}).`,
          });
        }

        const logoPath = path.resolve(import.meta.dirname, "assets", "Logo.jpg");
        let logoBuffer: Buffer | undefined;
        try {
          logoBuffer = await fs.promises.readFile(logoPath);
        } catch {
          logoBuffer = undefined;
        }

        // Inject latest admin decision (if any) into the PDF signature block.
        const approvals = await db.getApprovalsByFormId("daily", report.id);
        const latestApproval = approvals?.[0];
        const admin = latestApproval ? await db.getUserById(latestApproval.adminId) : undefined;

        const approvalForPdf = latestApproval
          ? {
              decision: latestApproval.decision,
              adminName: admin?.name || null,
              timestamp: latestApproval.timestamp,
              comments: latestApproval.comments,
            }
          : undefined;

        const pdfBuffer = await generateDailyReportPDF(report, logoBuffer, approvalForPdf);
        return { pdf: pdfBuffer.toString("base64"), filename: `daily-report-${report.id}-${Date.now()}.pdf` };
      }),
  }),

  // ── Concrete Tests ──────────────────────────────────────────────────────────
  concreteTest: router({
    create: protectedProcedure
      .input(concreteTestSchema)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot submit forms" });
        }

        const result = await db.createConcreteTest({
          userId: ctx.user.id,
          permitNo: input.permitNo,
          fileNo: input.fileNo ?? null,
          meiProjectNoName: input.meiProjectNoName,
          contractor: input.contractor,
          subContractor: input.subContractor ?? null,
          buildingNo: input.buildingNo ?? null,
          floorDeck: input.floorDeck ?? null,
          other: input.other ?? null,
          specificLocation: input.specificLocation ?? null,
          footing: input.footing,
          postTension: input.postTension,
          masonryWall: input.masonryWall,
          columns: input.columns,
          walls: input.walls,
          masonryColumns: input.masonryColumns,
          slabOnGrade: input.slabOnGrade,
          beams: input.beams,
          masonryPrisms: input.masonryPrisms,
          supplier: input.supplier ?? null,
          material: input.material ?? null,
          sampledBy: input.sampledBy ?? null,
          ticketNo: input.ticketNo ?? null,
          dateSampled: input.dateSampled ?? null,
          time: input.time ?? null,
          loadNo: input.loadNo ?? null,
          dateReceived: input.dateReceived ?? null,
          setNo: input.setNo ?? null,
          truckNo: input.truckNo ?? null,
          weather: input.weather ?? null,
          mixDesignNo: input.mixDesignNo ?? null,
          cementFactorSkCy: input.cementFactorSkCy ?? null,
          maxSizeAggIn: input.maxSizeAggIn ?? null,
          admixture: input.admixture ?? null,
          specifiedStrengthPsi: input.specifiedStrengthPsi ?? null,
          slumpInSpecified: input.slumpInSpecified ?? null,
          slumpInMeasured: input.slumpInMeasured ?? null,
          mixTempFSpecified: input.mixTempFSpecified ?? null,
          mixTempFMeasured: input.mixTempFMeasured ?? null,
          airTempFSpecified: input.airTempFSpecified ?? null,
          airTempFMeasured: input.airTempFMeasured ?? null,
          airContentSpecified: input.airContentSpecified ?? null,
          airContentMeasured: input.airContentMeasured ?? null,
          specimens: input.specimens,
          comments: input.comments ?? null,
          status: "pending",
        });

        const formId = result?.id || 0;

        const adminRecipients = await getAdminRecipients();
        await dispatchNotificationSafely("concrete test submitted", () =>
          notifyAdminConcreteTestSubmitted(
            { ...input, userId: ctx.user.id, id: formId, status: "pending", createdAt: new Date(), updatedAt: new Date() } as any,
            ctx.user,
            adminRecipients
          )
        );

        return { success: true, id: formId };
      }),

    edit: protectedProcedure
      .input(z.object({ id: z.number() }).merge(concreteTestSchema))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const test = await db.getConcreteTestById(id);

        if (!test) throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
        if (ctx.user.role !== "admin" && test.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit other users' tests" });
        }

        await db.updateConcreteTest(id, {
          ...data,
          fileNo: data.fileNo ?? null,
          subContractor: data.subContractor ?? null,
          buildingNo: data.buildingNo ?? null,
          floorDeck: data.floorDeck ?? null,
          other: data.other ?? null,
          specificLocation: data.specificLocation ?? null,
          supplier: data.supplier ?? null,
          material: data.material ?? null,
          sampledBy: data.sampledBy ?? null,
          ticketNo: data.ticketNo ?? null,
          dateSampled: data.dateSampled ?? null,
          time: data.time ?? null,
          loadNo: data.loadNo ?? null,
          dateReceived: data.dateReceived ?? null,
          setNo: data.setNo ?? null,
          truckNo: data.truckNo ?? null,
          weather: data.weather ?? null,
          mixDesignNo: data.mixDesignNo ?? null,
          cementFactorSkCy: data.cementFactorSkCy ?? null,
          maxSizeAggIn: data.maxSizeAggIn ?? null,
          admixture: data.admixture ?? null,
          specifiedStrengthPsi: data.specifiedStrengthPsi ?? null,
          slumpInSpecified: data.slumpInSpecified ?? null,
          slumpInMeasured: data.slumpInMeasured ?? null,
          mixTempFSpecified: data.mixTempFSpecified ?? null,
          mixTempFMeasured: data.mixTempFMeasured ?? null,
          airTempFSpecified: data.airTempFSpecified ?? null,
          airTempFMeasured: data.airTempFMeasured ?? null,
          airContentSpecified: data.airContentSpecified ?? null,
          airContentMeasured: data.airContentMeasured ?? null,
          comments: data.comments ?? null,
        });
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const test = await db.getConcreteTestById(input);
        if (!test) throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
        const employee = await db.getUserById(test.userId);
        return { ...test, employeeName: employee?.name || "Unknown" };
      }),

    getUserTests: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot view personal submissions" });
        }
        return await db.getConcreteTestsByUserId(ctx.user.id);
      }),

    getAllTests: adminProcedure
      .query(async () => {
        return await db.getAllConcreteTests();
      }),

    updateStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["pending", "approved", "rejected"]) }))
      .mutation(async ({ input }) => {
        await db.updateConcreteTestStatus(input.id, input.status);
        return { success: true };
      }),

    downloadPDF: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const test = await db.getConcreteTestById(input);
        if (!test) throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
        const logoPath = path.resolve(import.meta.dirname, "assets", "Logo.jpg");
        let logoBuffer: Buffer | undefined;
        try {
          logoBuffer = await fs.promises.readFile(logoPath);
        } catch {
          logoBuffer = undefined;
        }
        const pdfBuffer = await generateConcreteTestPDF(test, logoBuffer);
        return { pdf: pdfBuffer.toString("base64"), filename: `concrete-test-${test.id}-${Date.now()}.pdf` };
      }),
  }),

  // ── Approvals ───────────────────────────────────────────────────────────────
  approval: router({
    approveDailyReport: adminProcedure
      .input(z.object({ reportId: z.number() }).merge(approvalSchema))
      .mutation(async ({ ctx, input }) => {
        const report = await db.getDailyFieldReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });

        const employee = await db.getUserById(report.userId);
        if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });

        await db.updateDailyFieldReportStatus(input.reportId, input.decision);
        await db.createApproval({
          formType: "daily",
          formId: input.reportId,
          adminId: ctx.user.id,
          decision: input.decision,
          comments: input.comments,
        });

        if (input.decision === "approved") {
          await dispatchNotificationSafely("daily report approved", () =>
            notifyEmployeeDailyReportApproved(report, employee, input.comments)
          );
        } else {
          await dispatchNotificationSafely("daily report rejected", () =>
            notifyEmployeeDailyReportRejected(report, employee, input.comments)
          );
        }

        return { success: true };
      }),

    approveConcreteTest: adminProcedure
      .input(z.object({ testId: z.number() }).merge(approvalSchema))
      .mutation(async ({ ctx, input }) => {
        const test = await db.getConcreteTestById(input.testId);
        if (!test) throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });

        const employee = await db.getUserById(test.userId);
        if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });

        await db.updateConcreteTestStatus(input.testId, input.decision);
        await db.createApproval({
          formType: "concrete",
          formId: input.testId,
          adminId: ctx.user.id,
          decision: input.decision,
          comments: input.comments,
        });

        if (input.decision === "approved") {
          await dispatchNotificationSafely("concrete test approved", () =>
            notifyEmployeeConcreteTestApproved(test, employee, input.comments)
          );
        } else {
          await dispatchNotificationSafely("concrete test rejected", () =>
            notifyEmployeeConcreteTestRejected(test, employee, input.comments)
          );
        }

        return { success: true };
      }),

    getApprovals: adminProcedure
      .input(z.object({ formType: z.enum(["daily", "concrete"]), formId: z.number() }))
      .query(async ({ input }) => {
        return await db.getApprovalsByFormId(input.formType, input.formId);
      }),
  }),

  // ── Other routers ───────────────────────────────────────────────────────────
  attachment: attachmentRouter,
  template: templateRouter,
  analytics: analyticsRouter,
  notifications: notificationsRouter,

  suggestions: router({
    inspectionTypes: publicProcedure
      .input(z.object({ projectName: z.string() }))
      .query(async ({ input }) => {
        return await getSuggestedInspectionTypes(input.projectName);
      }),

    contractors: publicProcedure
      .query(async () => {
        return await getSuggestedContractors();
      }),

    clients: publicProcedure
      .query(async () => {
        return await getSuggestedClients();
      }),

    averageConcreteStrength: publicProcedure
      .input(z.object({ projectName: z.string() }))
      .query(async ({ input }) => {
        return await getAverageConcreteStrength(input.projectName);
      }),

    mixDesigns: publicProcedure
      .query(async () => {
        return await getSuggestedMixDesigns();
      }),
  }),

  users: usersRouter,
});

export type AppRouter = typeof appRouter;
