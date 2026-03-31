import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  decimal,
  boolean,
  datetime,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role field for admin/employee separation.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: text("passwordHash"),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Daily Field Reports collection
 * Captures on-site inspection details submitted by employees
 */
export const dailyFieldReports = mysqlTable("daily_field_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Job Information
  jobNo: varchar("jobNo", { length: 100 }).notNull(),
  permitNo: varchar("permitNo", { length: 100 }).notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  client: varchar("client", { length: 255 }).notNull(),
  location: text("location").notNull(),
  contractor: varchar("contractor", { length: 255 }).notNull(),

  // Date, Time & Weather
  date: timestamp("date", { mode: "string" }).notNull(),
  time: varchar("time", { length: 10 }),
  weather: varchar("weather", { length: 100 }),

  // Inspection Types
  inspectionTypes: json("inspectionTypes").$type<string[]>().notNull(),

  // Conformance
  workConformance: mysqlEnum("workConformance", ["met", "not_met"]).notNull(),
  workRequirements: mysqlEnum("workRequirements", ["met", "not_met"]).default("met").notNull(),
  materialSampling: mysqlEnum("materialSampling", ["performed", "not_performed"]).notNull(),

  // Notes
  notes: text("notes"),

  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyFieldReport = typeof dailyFieldReports.$inferSelect;
export type InsertDailyFieldReport = typeof dailyFieldReports.$inferInsert;

// ── Specimen type used in concrete_tests.specimens JSON ──────────────────────
export type Specimen = {
  specimenNo: string;
  setNo: string;
  agedDays: string;
  dateTested: string;
  dimensions: string;
  areaSquareIn: string;
  ultimateLoadLbs: string;
  compressiveStrengthPsi: string;
  averageStrengthPsi: string;
  labTechnician: string;
  labManager: string;
};

/**
 * Concrete Tests collection
 * Captures concrete compression test data per the MEI Concrete Compression Test Data form
 */
export const concreteTests = mysqlTable("concrete_tests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Project Information
  permitNo: varchar("permitNo", { length: 100 }).notNull(),
  fileNo: varchar("fileNo", { length: 100 }),
  meiProjectNoName: varchar("meiProjectNoName", { length: 255 }).notNull(),
  contractor: varchar("contractor", { length: 255 }).notNull(),
  subContractor: varchar("subContractor", { length: 255 }),
  buildingNo: varchar("buildingNo", { length: 100 }),
  floorDeck: varchar("floorDeck", { length: 100 }),
  other: varchar("other", { length: 100 }),
  specificLocation: text("specificLocation"),

  // Placement Type
  footing: boolean("footing").default(false).notNull(),
  postTension: boolean("postTension").default(false).notNull(),
  masonryWall: boolean("masonryWall").default(false).notNull(),
  columns: boolean("columns").default(false).notNull(),
  walls: boolean("walls").default(false).notNull(),
  masonryColumns: boolean("masonryColumns").default(false).notNull(),
  slabOnGrade: boolean("slabOnGrade").default(false).notNull(),
  beams: boolean("beams").default(false).notNull(),
  masonryPrisms: boolean("masonryPrisms").default(false).notNull(),

  // Sample Information
  supplier: varchar("supplier", { length: 255 }),
  material: varchar("material", { length: 255 }),
  sampledBy: varchar("sampledBy", { length: 255 }),
  ticketNo: varchar("ticketNo", { length: 100 }),
  dateSampled: datetime("dateSampled", { mode: "string" }),
  time: varchar("time", { length: 10 }),
  loadNo: varchar("loadNo", { length: 100 }),
  dateReceived: datetime("dateReceived", { mode: "string" }),
  setNo: varchar("setNo", { length: 100 }),
  truckNo: varchar("truckNo", { length: 100 }),
  weather: varchar("weather", { length: 100 }),
  mixDesignNo: varchar("mixDesignNo", { length: 100 }),
  cementFactorSkCy: decimal("cementFactorSkCy", { precision: 10, scale: 3 }),
  maxSizeAggIn: decimal("maxSizeAggIn", { precision: 10, scale: 3 }),
  admixture: varchar("admixture", { length: 255 }),
  specifiedStrengthPsi: int("specifiedStrengthPsi"),

  // Specified vs Measured
  slumpInSpecified: decimal("slumpInSpecified", { precision: 6, scale: 2 }),
  slumpInMeasured: decimal("slumpInMeasured", { precision: 6, scale: 2 }),
  mixTempFSpecified: decimal("mixTempFSpecified", { precision: 6, scale: 2 }),
  mixTempFMeasured: decimal("mixTempFMeasured", { precision: 6, scale: 2 }),
  airTempFSpecified: decimal("airTempFSpecified", { precision: 6, scale: 2 }),
  airTempFMeasured: decimal("airTempFMeasured", { precision: 6, scale: 2 }),
  airContentSpecified: decimal("airContentSpecified", { precision: 6, scale: 2 }),
  airContentMeasured: decimal("airContentMeasured", { precision: 6, scale: 2 }),

  // Specimen Data (7 specimens)
  specimens: json("specimens").$type<Specimen[]>().notNull(),

  // Comments & Status
  comments: text("comments"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConcreteTest = typeof concreteTests.$inferSelect;
export type InsertConcreteTest = typeof concreteTests.$inferInsert;

/**
 * Approvals collection
 * Tracks approval/rejection decisions by admins
 */
export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  formType: mysqlEnum("formType", ["daily", "concrete"]).notNull(),
  formId: int("formId").notNull(),
  adminId: int("adminId").notNull(),
  decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
  comments: text("comments"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Approval = typeof approvals.$inferSelect;
export type InsertApproval = typeof approvals.$inferInsert;

/**
 * Notifications collection
 * Stores in-app notifications for admins and employees.
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: mysqlEnum("category", ["submission", "approval", "rejection", "system"]).default("system").notNull(),
  sourceFormType: mysqlEnum("sourceFormType", ["daily", "concrete"]),
  sourceFormId: int("sourceFormId"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Attachments collection
 * Stores file attachments for daily reports and concrete tests
 */
export const attachments = mysqlTable("attachments", {
  id: int("id").autoincrement().primaryKey(),
  formType: mysqlEnum("formType", ["daily", "concrete"]).notNull(),
  formId: int("formId").notNull(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(), // S3 key
  fileUrl: text("fileUrl").notNull(), // S3 URL
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(), // in bytes
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

/**
 * Form Templates collection
 * Stores reusable form templates created by admins
 */
export const formTemplates = mysqlTable("form_templates", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull(), // admin user id
  formType: mysqlEnum("formType", ["daily", "concrete"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateData: json("templateData").notNull(), // stores the form data template
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormTemplate = typeof formTemplates.$inferInsert;
