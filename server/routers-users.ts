import { router, adminProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as dbUsers from "./db-users";
import { TRPCError } from "@trpc/server";

export const usersRouter = router({
  // Get all users (admin only)
  listAll: adminProcedure.query(async () => {
    return await dbUsers.getAllUsersForAdmin();
  }),

  // Create new user (admin only)
  create: adminProcedure
    .input(z.object({
      username: z.string().min(3, "Username must be at least 3 characters"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      email: z.string().email(),
      name: z.string().min(1, "Name is required"),
      role: z.enum(['admin', 'user']).default('user'),
    }))
    .mutation(async ({ input }) => {
      try {
        return await dbUsers.createUserWithPassword(input);
      } catch (error: any) {
        if (error.message.includes('Duplicate entry')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Username or email already exists',
          });
        }
        throw error;
      }
    }),

  // Update user role (admin only)
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['admin', 'user']),
    }))
    .mutation(async ({ input }) => {
      await dbUsers.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  // Deactivate user (admin only)
  deactivate: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await dbUsers.deactivateUser(input.userId);
      return { success: true };
    }),

  // Activate user (admin only)
  activate: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await dbUsers.activateUser(input.userId);
      return { success: true };
    }),

  // Update own password (authenticated users)
  updatePassword: protectedProcedure
    .input(z.object({
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      
      await dbUsers.updateUserPassword(ctx.user.id, input.newPassword);
      return { success: true };
    }),

  // Delete user (admin only)
  delete: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await dbUsers.deleteUser(input.userId);
      return { success: true };
    }),
});
