import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notifications, users, type InsertNotification } from "../drizzle/schema";
import { getDb } from "./db";

let notificationsTableUnavailable = false;
let notificationsTableWarningShown = false;

function isMissingNotificationsTableError(error: unknown) {
  const queue = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const record = current as {
      message?: string;
      code?: string;
      sqlMessage?: string;
      cause?: unknown;
    };

    const message = String(record.message ?? "");
    const sqlMessage = String(record.sqlMessage ?? "");
    const code = String(record.code ?? "");
    const combined = `${message} ${sqlMessage}`;

    if (
      code === "ER_NO_SUCH_TABLE" ||
      (combined.includes("notifications") &&
        (combined.includes("doesn't exist") || combined.includes("ER_NO_SUCH_TABLE")))
    ) {
      return true;
    }

    if (record.cause) {
      queue.push(record.cause);
    }
  }

  return false;
}

function handleNotificationError(context: string, error: unknown) {
  if (isMissingNotificationsTableError(error)) {
    notificationsTableUnavailable = true;
    if (!notificationsTableWarningShown) {
      notificationsTableWarningShown = true;
      console.warn("[Notifications] notifications table is not available yet; local inbox features are temporarily disabled until migrations are applied.");
    }
    return;
  }

  console.warn(`[Notifications] ${context}:`, error);
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) {
    console.warn("[Notifications] Database unavailable; skipping createNotification");
    return null;
  }
  if (notificationsTableUnavailable) return null;

  try {
    const result = await db.insert(notifications).values(data);
    return result;
  } catch (error) {
    handleNotificationError("Failed to create notification", error);
    return null;
  }
}

export async function createNotifications(data: InsertNotification[]) {
  const db = await getDb();
  if (!db) {
    console.warn("[Notifications] Database unavailable; skipping createNotifications");
    return;
  }
  if (notificationsTableUnavailable) return;

  if (!data.length) return;
  try {
    await db.insert(notifications).values(data);
  } catch (error) {
    handleNotificationError("Failed to create notifications", error);
  }
}

export async function listNotificationsForUser(recipientUserId: number) {
  const db = await getDb();
  if (!db || notificationsTableUnavailable) return [];

  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, recipientUserId))
      .orderBy(desc(notifications.createdAt));
  } catch (error) {
    handleNotificationError("Failed to list notifications", error);
    return [];
  }
}

export async function markNotificationRead(id: number, recipientUserId: number) {
  const db = await getDb();
  if (!db || notificationsTableUnavailable) return;

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)));
  } catch (error) {
    handleNotificationError("Failed to mark notification read", error);
  }
}

export async function markAllNotificationsRead(recipientUserId: number) {
  const db = await getDb();
  if (!db || notificationsTableUnavailable) return;

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)));
  } catch (error) {
    handleNotificationError("Failed to mark all notifications read", error);
  }
}

export async function getUnreadNotificationCount(recipientUserId: number) {
  const db = await getDb();
  if (!db || notificationsTableUnavailable) return 0;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)));

    return Number(result[0]?.count ?? 0);
  } catch (error) {
    handleNotificationError("Failed to get unread count", error);
    return 0;
  }
}

export async function getAdminRecipients() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true)));
  } catch (error) {
    console.warn("[Notifications] Failed to get admin recipients:", error);
    return [];
  }
}
