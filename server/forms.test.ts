import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  createDailyFieldReport: vi.fn().mockResolvedValue({ insertId: 1 }),
  getDailyFieldReportById: vi.fn(),
  getDailyFieldReportsByUserId: vi.fn().mockResolvedValue([]),
  getAllDailyFieldReports: vi.fn().mockResolvedValue([]),
  updateDailyFieldReport: vi.fn().mockResolvedValue(undefined),
  updateDailyFieldReportStatus: vi.fn().mockResolvedValue(undefined),
  createConcreteTest: vi.fn().mockResolvedValue({ insertId: 1 }),
  getConcreteTestById: vi.fn(),
  getConcreteTestsByUserId: vi.fn().mockResolvedValue([]),
  getAllConcreteTests: vi.fn().mockResolvedValue([]),
  updateConcreteTest: vi.fn().mockResolvedValue(undefined),
  updateConcreteTestStatus: vi.fn().mockResolvedValue(undefined),
  createApproval: vi.fn().mockResolvedValue(undefined),
  getApprovalsByFormId: vi.fn().mockResolvedValue([]),
  getUserById: vi.fn(),
}));

// Mock notification functions
vi.mock("./notifications", () => ({
  notifyAdminDailyReportSubmitted: vi.fn().mockResolvedValue(true),
  notifyAdminConcreteTestSubmitted: vi.fn().mockResolvedValue(true),
  notifyEmployeeDailyReportApproved: vi.fn().mockResolvedValue(true),
  notifyEmployeeDailyReportRejected: vi.fn().mockResolvedValue(true),
  notifyEmployeeConcreteTestApproved: vi.fn().mockResolvedValue(true),
  notifyEmployeeConcreteTestRejected: vi.fn().mockResolvedValue(true),
}));

// Mock suggestion functions
vi.mock("./suggestions", () => ({
  getSuggestedInspectionTypes: vi.fn().mockResolvedValue(["Foundation", "Framing"]),
  getSuggestedContractors: vi.fn().mockResolvedValue(["Contractor A"]),
  getSuggestedClients: vi.fn().mockResolvedValue(["Client A"]),
  getAverageConcreteStrength: vi.fn().mockResolvedValue(3500),
  getSuggestedMixDesigns: vi.fn().mockResolvedValue(["MD-001"]),
}));

// Mock PDF functions
vi.mock("./pdf", () => ({
  generateDailyReportPDF: vi.fn().mockResolvedValue(Buffer.from("PDF")),
  generateConcreteTestPDF: vi.fn().mockResolvedValue(Buffer.from("PDF")),
}));

// ── Shared specimen fixture (7 specimens matching the new form) ───────────────
const makeSpecimens = (count = 7) =>
  Array.from({ length: count }, (_, i) => ({
    specimenNo: `SP-00${i + 1}`,
    setNo: "S1",
    agedDays: "28",
    dateTested: new Date().toISOString().split("T")[0],
    dimensions: "6x12",
    areaSquareIn: "28.27",
    ultimateLoadLbs: "113080",
    compressiveStrengthPsi: "4000",
    averageStrengthPsi: "4100",
    labTechnician: "John Doe",
    labManager: "Jane Smith",
  }));

function createEmployeeContext(): { ctx: TrpcContext; user: User } {
  const user: User = {
    id: 1,
    openId: "employee-user",
    username: null,
    passwordHash: null,
    email: "employee@example.com",
    name: "Employee User",
    loginMethod: "manus",
    role: "user",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };

  return { ctx, user };
}

function createAdminContext(): { ctx: TrpcContext; user: User } {
  const user: User = {
    id: 2,
    openId: "admin-user",
    username: null,
    passwordHash: null,
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };

  return { ctx, user };
}

// ── Daily Field Reports ───────────────────────────────────────────────────────

describe("Daily Field Reports", () => {
  it("allows employees to create daily field reports", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dailyReport.create({
      jobNo: "JOB-001",
      permitNo: "PERMIT-001",
      projectName: "Test Project",
      client: "Test Client",
      location: "Test Location",
      contractor: "Test Contractor",
      date: new Date(),
      time: "08:00",
      weather: "Sunny",
      inspectionTypes: ["Masonry", "Concrete"],
      workConformance: "met",
      workRequirements: "met",
      materialSampling: "performed",
      notes: "No issues observed.",
    });

    expect(result.success).toBe(true);
  });

  it("prevents admins from creating daily field reports", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.dailyReport.create({
        jobNo: "JOB-001",
        permitNo: "PERMIT-001",
        projectName: "Test Project",
        client: "Test Client",
        location: "Test Location",
        contractor: "Test Contractor",
        date: new Date(),
        time: "08:00",
        inspectionTypes: ["Foundation"],
        workConformance: "met",
        workRequirements: "met",
        materialSampling: "performed",
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toContain("Admins cannot submit forms");
    }
  });

  it("allows employees to view their own reports", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dailyReport.getUserReports();
    expect(Array.isArray(result)).toBe(true);
  });

  it("prevents employees from viewing all reports", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.dailyReport.getAllReports();
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("allows admins to view all reports", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dailyReport.getAllReports();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Concrete Tests ────────────────────────────────────────────────────────────

describe("Concrete Tests", () => {
  it("allows employees to create concrete tests", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.concreteTest.create({
      permitNo: "PERMIT-001",
      fileNo: "FILE-001",
      meiProjectNoName: "2024-001 Test Project",
      contractor: "Test Contractor",
      subContractor: "Sub Contractor Inc.",
      buildingNo: "B-1",
      floorDeck: "Level 3",
      other: "Walls",
      specificLocation: "Grid A3 – Column Line 4",
      // Placement type
      footing: true,
      postTension: false,
      masonryWall: false,
      columns: true,
      walls: false,
      masonryColumns: false,
      slabOnGrade: false,
      beams: false,
      masonryPrisms: false,
      // Sample info
      supplier: "Concrete Co.",
      material: "Ready Mix Concrete",
      sampledBy: "John Inspector",
      ticketNo: "TKT-001",
      dateSampled: new Date().toISOString().split("T")[0],
      time: "09:00",
      loadNo: "L-001",
      dateReceived: new Date().toISOString().split("T")[0],
      setNo: "S-001",
      truckNo: "T-42",
      weather: "Sunny",
      mixDesignNo: "MIX-001",
      cementFactorSkCy: "6.5",
      maxSizeAggIn: "0.75",
      admixture: "None",
      specifiedStrengthPsi: "4000",
      // Specified vs measured
      slumpInSpecified: "4",
      slumpInMeasured: "3.5",
      mixTempFSpecified: "65",
      mixTempFMeasured: "68",
      airTempFSpecified: "70",
      airTempFMeasured: "72",
      airContentSpecified: "5",
      airContentMeasured: "4.8",
      // Specimens
      specimens: makeSpecimens(7),
      comments: "All specimens within tolerance.",
    });

    expect(result.success).toBe(true);
  });

  it("prevents admins from creating concrete tests", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.concreteTest.create({
        permitNo: "PERMIT-001",
        meiProjectNoName: "2024-001 Test Project",
        contractor: "Test Contractor",
        specimens: makeSpecimens(7),
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("stores all 7 specimen rows correctly", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    const specimens = makeSpecimens(7);

    const result = await caller.concreteTest.create({
      permitNo: "PERMIT-002",
      meiProjectNoName: "2024-002 Specimen Test",
      contractor: "Specimen Contractor",
      specimens,
    });

    expect(result.success).toBe(true);
  });
});

// ── Approvals ─────────────────────────────────────────────────────────────────

describe("Approvals", () => {
  it("allows admins to approve daily reports", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const { getDailyFieldReportById, getUserById } = await import("./db");

    const employeeUser: User = {
      id: 1,
      openId: "employee-user",
      username: null,
      passwordHash: null,
      email: "employee@example.com",
      name: "Employee User",
      loginMethod: "manus",
      role: "user",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    vi.mocked(getUserById).mockResolvedValueOnce(employeeUser);
    vi.mocked(getDailyFieldReportById).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      jobNo: "JOB-001",
      permitNo: "PERMIT-001",
      projectName: "Test Project",
      client: "Test Client",
      location: "Test Location",
      contractor: "Test Contractor",
      date: new Date(),
      weather: "Sunny",
      inspectionTypes: ["Masonry"],
      workConformance: "met",
      workRequirements: "met",
      materialSampling: "performed",
      notes: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await caller.approval.approveDailyReport({
      reportId: 1,
      decision: "approved",
      comments: "Looks good",
    });

    expect(result.success).toBe(true);
  });

  it("allows admins to edit daily reports after approval", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const { getDailyFieldReportById, updateDailyFieldReport } = await import("./db");

    vi.mocked(getDailyFieldReportById).mockResolvedValueOnce({
      id: 7,
      userId: 1,
      jobNo: "JOB-007",
      permitNo: "PERMIT-007",
      projectName: "Editable Project",
      client: "Client",
      location: "Location",
      contractor: "Contractor",
      date: new Date(),
      time: "10:00",
      weather: "Sunny",
      inspectionTypes: ["Concrete"],
      workConformance: "met",
      workRequirements: "met",
      materialSampling: "performed",
      notes: null,
      status: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await caller.dailyReport.edit({
      id: 7,
      jobNo: "JOB-007",
      permitNo: "PERMIT-007",
      projectName: "Editable Project",
      client: "Client",
      location: "Updated Location",
      contractor: "Contractor",
      date: new Date(),
      time: "10:00",
      weather: "Sunny",
      inspectionTypes: ["Concrete"],
      workConformance: "met",
      workRequirements: "met",
      materialSampling: "performed",
      notes: "Updated by admin",
    });

    expect(result.success).toBe(true);
    expect(updateDailyFieldReport).toHaveBeenCalled();
  });

  it("allows employees to edit rejected concrete tests", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);
    const { getConcreteTestById, updateConcreteTest } = await import("./db");

    vi.mocked(getConcreteTestById).mockResolvedValueOnce({
      id: 9,
      userId: 1,
      permitNo: "PERMIT-009",
      fileNo: "FILE-009",
      meiProjectNoName: "Project 009",
      contractor: "Contractor",
      subContractor: null,
      buildingNo: null,
      floorDeck: null,
      other: null,
      specificLocation: null,
      footing: true,
      postTension: false,
      masonryWall: false,
      columns: false,
      walls: false,
      masonryColumns: false,
      slabOnGrade: false,
      beams: false,
      masonryPrisms: false,
      supplier: null,
      material: null,
      sampledBy: null,
      ticketNo: null,
      dateSampled: null,
      time: null,
      loadNo: null,
      dateReceived: null,
      setNo: null,
      truckNo: null,
      weather: null,
      mixDesignNo: null,
      cementFactorSkCy: null,
      maxSizeAggIn: null,
      admixture: null,
      specifiedStrengthPsi: null,
      slumpInSpecified: null,
      slumpInMeasured: null,
      mixTempFSpecified: null,
      mixTempFMeasured: null,
      airTempFSpecified: null,
      airTempFMeasured: null,
      airContentSpecified: null,
      airContentMeasured: null,
      specimens: makeSpecimens(1),
      comments: null,
      status: "rejected",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await caller.concreteTest.edit({
      id: 9,
      permitNo: "PERMIT-009",
      fileNo: "FILE-009",
      meiProjectNoName: "Project 009",
      contractor: "Contractor",
      specimens: makeSpecimens(1),
      comments: "Revised",
    } as any);

    expect(result.success).toBe(true);
    expect(updateConcreteTest).toHaveBeenCalled();
  });

  it("prevents employees from approving reports", async () => {
    const { ctx } = createEmployeeContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.approval.approveDailyReport({
        reportId: 1,
        decision: "approved",
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
