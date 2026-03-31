import { eq, and, desc, sql, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, dailyFieldReports, concreteTests, approvals } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

function extractInsertId(result: any): number {
  // mysql2/drizzle can return insert metadata in different shapes depending on driver/version.
  const candidates = [
    result?.insertId,
    result?.[0]?.insertId,
    result?.rows?.insertId,
    result?.rows?.[0]?.insertId,
  ];

  for (const value of candidates) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) return id;
  }

  return 0;
}

function isMissingWorkRequirementsColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("workRequirements");
}

function omitWorkRequirements<T extends Record<string, any>>(data: T): Omit<T, "workRequirements"> {
  const { workRequirements, ...rest } = data;
  return rest;
}

async function createDailyFieldReportLegacy(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  data: Omit<typeof dailyFieldReports.$inferInsert, "workRequirements">
) {
  const result = await db.execute(sql`
    insert into daily_field_reports (
      userId, jobNo, permitNo, projectName, client, location, contractor,
      date, time, weather, inspectionTypes, workConformance, materialSampling, notes, status
    ) values (
      ${data.userId},
      ${data.jobNo},
      ${data.permitNo},
      ${data.projectName},
      ${data.client},
      ${data.location},
      ${data.contractor},
      ${data.date},
      ${data.time ?? null},
      ${data.weather ?? null},
      ${JSON.stringify(data.inspectionTypes ?? [])},
      ${data.workConformance},
      ${data.materialSampling},
      ${data.notes ?? null},
      ${data.status ?? "pending"}
    )
  `);
  const insertedId = extractInsertId(result);
  return { ...result, id: insertedId } as any;
}

async function updateDailyFieldReportLegacy(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  id: number,
  data: Omit<Partial<typeof dailyFieldReports.$inferInsert>, "workRequirements">
) {
  const keep = (column: string) => sql.raw(column);

  await db.execute(sql`
    update daily_field_reports
    set
      jobNo = ${data.jobNo ?? keep("jobNo")},
      permitNo = ${data.permitNo ?? keep("permitNo")},
      projectName = ${data.projectName ?? keep("projectName")},
      client = ${data.client ?? keep("client")},
      location = ${data.location ?? keep("location")},
      contractor = ${data.contractor ?? keep("contractor")},
      date = ${data.date ?? keep("date")},
      time = ${data.time ?? keep("time")},
      weather = ${data.weather ?? keep("weather")},
      inspectionTypes = ${data.inspectionTypes ? JSON.stringify(data.inspectionTypes) : keep("inspectionTypes")},
      workConformance = ${data.workConformance ?? keep("workConformance")},
      materialSampling = ${data.materialSampling ?? keep("materialSampling")},
      notes = ${data.notes ?? keep("notes")},
      status = ${data.status ?? keep("status")},
      updatedAt = ${new Date()}
    where id = ${id}
  `);
}

async function getDailyFieldReportByIdLegacy(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, id: number) {
  const result = await db.select({
    id: dailyFieldReports.id,
    userId: dailyFieldReports.userId,
    jobNo: dailyFieldReports.jobNo,
    permitNo: dailyFieldReports.permitNo,
    projectName: dailyFieldReports.projectName,
    client: dailyFieldReports.client,
    location: dailyFieldReports.location,
    contractor: dailyFieldReports.contractor,
    date: dailyFieldReports.date,
    time: dailyFieldReports.time,
    weather: dailyFieldReports.weather,
    inspectionTypes: dailyFieldReports.inspectionTypes,
    workConformance: dailyFieldReports.workConformance,
    workRequirements: dailyFieldReports.workConformance,
    materialSampling: dailyFieldReports.materialSampling,
    notes: dailyFieldReports.notes,
    status: dailyFieldReports.status,
    createdAt: dailyFieldReports.createdAt,
    updatedAt: dailyFieldReports.updatedAt,
  }).from(dailyFieldReports).where(eq(dailyFieldReports.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

async function getDailyFieldReportsByUserIdLegacy(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) {
  return await db.select({
    id: dailyFieldReports.id,
    userId: dailyFieldReports.userId,
    jobNo: dailyFieldReports.jobNo,
    permitNo: dailyFieldReports.permitNo,
    projectName: dailyFieldReports.projectName,
    client: dailyFieldReports.client,
    location: dailyFieldReports.location,
    contractor: dailyFieldReports.contractor,
    date: dailyFieldReports.date,
    time: dailyFieldReports.time,
    weather: dailyFieldReports.weather,
    inspectionTypes: dailyFieldReports.inspectionTypes,
    workConformance: dailyFieldReports.workConformance,
    workRequirements: dailyFieldReports.workConformance,
    materialSampling: dailyFieldReports.materialSampling,
    notes: dailyFieldReports.notes,
    status: dailyFieldReports.status,
    createdAt: dailyFieldReports.createdAt,
    updatedAt: dailyFieldReports.updatedAt,
  }).from(dailyFieldReports)
    .where(eq(dailyFieldReports.userId, userId))
    .orderBy(desc(dailyFieldReports.createdAt));
}

async function getAllDailyFieldReportsLegacy(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return await db.select({
    id: dailyFieldReports.id,
    userId: dailyFieldReports.userId,
    jobNo: dailyFieldReports.jobNo,
    permitNo: dailyFieldReports.permitNo,
    projectName: dailyFieldReports.projectName,
    client: dailyFieldReports.client,
    location: dailyFieldReports.location,
    contractor: dailyFieldReports.contractor,
    date: dailyFieldReports.date,
    time: dailyFieldReports.time,
    weather: dailyFieldReports.weather,
    inspectionTypes: dailyFieldReports.inspectionTypes,
    workConformance: dailyFieldReports.workConformance,
    workRequirements: dailyFieldReports.workConformance,
    materialSampling: dailyFieldReports.materialSampling,
    notes: dailyFieldReports.notes,
    status: dailyFieldReports.status,
    createdAt: dailyFieldReports.createdAt,
    updatedAt: dailyFieldReports.updatedAt,
    employeeName: users.name,
  }).from(dailyFieldReports)
    .leftJoin(users, eq(dailyFieldReports.userId, users.id))
    .orderBy(desc(dailyFieldReports.createdAt));
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: Partial<InsertUser> & { openId: string; email: string }): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      email: user.email,
    };
    const updateSet: Record<string, unknown> = {};

    if (user.name !== undefined) {
      values.name = user.name || null;
      updateSet.name = user.name || null;
    }
    if (user.loginMethod !== undefined) {
      values.loginMethod = user.loginMethod || null;
      updateSet.loginMethod = user.loginMethod || null;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (user.username !== undefined) {
      values.username = user.username || null;
      updateSet.username = user.username || null;
    }

    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash || null;
      updateSet.passwordHash = user.passwordHash || null;
    }

    if (user.isActive !== undefined) {
      values.isActive = user.isActive;
      updateSet.isActive = user.isActive;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get users: database not available");
    return [];
  }

  return await db.select().from(users);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Daily Field Reports queries
export async function createDailyFieldReport(data: typeof dailyFieldReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    const result = await db.insert(dailyFieldReports).values(data);
    const insertedId = extractInsertId(result);
    if (!insertedId) {
      console.error("[DB] createDailyFieldReport: failed to resolve insertId from result", result);
    }
    return { ...result, id: insertedId } as any;
  } catch (error: any) {
    console.error("[DB] createDailyFieldReport failed:");
    console.error("  message:", error?.message);
    console.error("  code:", error?.code);
    console.error("  sqlState:", error?.sqlState);
    console.error("  sql:", error?.sql);
    console.error("  data keys:", Object.keys(data));
    console.error("  data values:", Object.values(data));
    if ("workRequirements" in data && isMissingWorkRequirementsColumnError(error)) {
      const legacyData = omitWorkRequirements(data);
      return await createDailyFieldReportLegacy(db, legacyData);
    }
    throw error;
  }
}

export async function getDailyFieldReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(dailyFieldReports).where(eq(dailyFieldReports.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    if (isMissingWorkRequirementsColumnError(error)) {
      return await getDailyFieldReportByIdLegacy(db, id);
    }
    throw error;
  }
}

export async function getDailyFieldReportsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(dailyFieldReports)
      .where(eq(dailyFieldReports.userId, userId))
      .orderBy(desc(dailyFieldReports.createdAt));
  } catch (error) {
    if (isMissingWorkRequirementsColumnError(error)) {
      return await getDailyFieldReportsByUserIdLegacy(db, userId);
    }
    throw error;
  }
}

export async function getAllDailyFieldReports() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select({
      ...getTableColumns(dailyFieldReports),
      employeeName: users.name,
    }).from(dailyFieldReports)
      .leftJoin(users, eq(dailyFieldReports.userId, users.id))
      .orderBy(desc(dailyFieldReports.createdAt));
  } catch (error) {
    if (isMissingWorkRequirementsColumnError(error)) {
      return await getAllDailyFieldReportsLegacy(db);
    }
    throw error;
  }
}

export async function updateDailyFieldReport(id: number, data: Partial<typeof dailyFieldReports.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.update(dailyFieldReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dailyFieldReports.id, id));
  } catch (error) {
    if (isMissingWorkRequirementsColumnError(error)) {
      await updateDailyFieldReportLegacy(db, id, omitWorkRequirements(data));
      return;
    }
    throw error;
  }
}

export async function updateDailyFieldReportStatus(id: number, status: 'pending' | 'approved' | 'rejected') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(dailyFieldReports)
    .set({ status, updatedAt: new Date() })
    .where(eq(dailyFieldReports.id, id));
}

// Concrete Tests queries
export async function createConcreteTest(data: typeof concreteTests.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(concreteTests).values(data);
  const insertedId = extractInsertId(result);
  if (!insertedId) {
    console.error("[DB] createConcreteTest: failed to resolve insertId from result", result);
  }
  return { ...result, id: insertedId } as any;
}

export async function getConcreteTestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(concreteTests).where(eq(concreteTests.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getConcreteTestsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(concreteTests)
    .where(eq(concreteTests.userId, userId))
    .orderBy(desc(concreteTests.createdAt));
}

export async function getAllConcreteTests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    ...getTableColumns(concreteTests),
    employeeName: users.name,
  }).from(concreteTests)
    .leftJoin(users, eq(concreteTests.userId, users.id))
    .orderBy(desc(concreteTests.createdAt));
}

export async function updateConcreteTest(id: number, data: Partial<typeof concreteTests.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(concreteTests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(concreteTests.id, id));
}

export async function updateConcreteTestStatus(id: number, status: 'pending' | 'approved' | 'rejected') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(concreteTests)
    .set({ status, updatedAt: new Date() })
    .where(eq(concreteTests.id, id));
}

// Approvals queries
export async function createApproval(data: typeof approvals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(approvals).values(data);
  return result;
}

export async function getApprovalsByFormId(formType: 'daily' | 'concrete', formId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(approvals)
    .where(and(eq(approvals.formType, formType), eq(approvals.formId, formId)))
    .orderBy(desc(approvals.timestamp));
}
