import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as dbNotifications from "./db-notifications";

export const notificationsRouter = router({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return await dbNotifications.listNotificationsForUser(ctx.user.id);
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return {
      count: await dbNotifications.getUnreadNotificationCount(ctx.user.id),
    };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await dbNotifications.markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await dbNotifications.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
});
