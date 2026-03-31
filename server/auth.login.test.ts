import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import * as db from "./db";
import { hashPassword } from "./auth-utils";
import type { TrpcContext } from "./_core/context";

describe("Auth Login", () => {
  let databaseAvailable = false;

  beforeAll(async () => {
    // Ensure database is initialized
    const database = await getDb();
    if (!database) {
      console.warn("Skipping auth login tests: database not available");
      return;
    }
    databaseAvailable = true;

    // Create a test user with username and password
    const passwordHash = await hashPassword("testpass123");
    
    try {
      await db.upsertUser({
        openId: "test-user-1",
        email: "testuser@example.com",
        name: "Test User",
        username: "testuser",
        passwordHash: passwordHash,
        isActive: true,
        role: "user",
        loginMethod: "local",
        lastSignedIn: new Date(),
      });
    } catch (error) {
      // User might already exist
      console.log("User creation note:", error);
    }
  });

  it("should successfully login with correct username and password", async () => {
    if (!databaseAvailable) return;

    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "testuser",
      password: "testpass123",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
    expect(result.role).toBe("user");
  });

  it("should fail with incorrect password", async () => {
    if (!databaseAvailable) return;

    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "testuser",
        password: "wrongpassword",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toContain("Invalid username or password");
    }
  });

  it("should fail with non-existent username", async () => {
    if (!databaseAvailable) return;

    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "nonexistent",
        password: "anypassword",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toContain("Invalid username or password");
    }
  });
});
