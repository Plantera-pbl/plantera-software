import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { notifications } from "@/server/db/schema";

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [notif] = await ctx.db
        .insert(notifications)
        .values({
          userId: ctx.userId,
          title: input.title,
          body: input.body,
        })
        .returning();
      return notif;
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          eq(notifications.read, false),
        ),
      );
  }),
});
