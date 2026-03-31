import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users } from "../drizzle/schema";
import { hashPassword } from "./auth-utils";

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

/**
 * Create a new user with username and password
 */
export async function createUserWithPassword(data: {
  username: string;
  password: string;
  email: string;
  name: string;
  role?: 'admin' | 'user';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await hashPassword(data.password);
  const openId = `local-${data.username}-${Date.now()}`;

  await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash,
    email: data.email,
    name: data.name,
    role: data.role || 'user',
    loginMethod: 'password',
    isActive: true,
    lastSignedIn: new Date(),
  });

  return { username: data.username, email: data.email, role: data.role || 'user' };
}

/**
 * Get all users (for admin)
 */
export async function getAllUsersForAdmin() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    name: users.name,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users);

  return allUsers;
}

/**
 * Update user role
 */
export async function updateUserRole(userId: number, role: 'admin' | 'user') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Deactivate user
 */
export async function deactivateUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Activate user
 */
export async function activateUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await hashPassword(newPassword);

  await db.update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Delete user
 */
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Hard delete the user from the database
  await db.delete(users).where(eq(users.id, userId));
}