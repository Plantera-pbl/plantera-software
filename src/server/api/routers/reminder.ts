import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { reminders } from "@/server/db/schema";

export const reminderRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(reminders)
      .where(eq(reminders.userId, ctx.userId))
      .orderBy(desc(reminders.dueAt))
      .limit(100);
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        note: z.string().max(2000).optional(),
        plantId: z.number().int().optional(),
        dueAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(reminders)
        .values({
          userId: ctx.userId,
          title: input.title,
          note: input.note ?? null,
          plantId: input.plantId ?? null,
          dueAt: input.dueAt,
        })
        .returning();
      return row;
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(reminders)
        .set({ done: true })
        .where(
          and(eq(reminders.id, input.id), eq(reminders.userId, ctx.userId)),
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(reminders)
        .where(
          and(eq(reminders.id, input.id), eq(reminders.userId, ctx.userId)),
        );
    }),
});
