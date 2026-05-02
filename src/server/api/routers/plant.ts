import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { plants } from "@/server/db/schema";

export const plantRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(plants)
      .where(eq(plants.userId, ctx.userId))
      .orderBy(desc(plants.createdAt));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        species: z.string().max(256).optional(),
        topic: z.string().max(512).optional(),
        photoUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [plant] = await ctx.db
        .insert(plants)
        .values({
          userId: ctx.userId,
          name: input.name,
          species: input.species ?? null,
          topic: input.topic ?? null,
          photoUrl: input.photoUrl ?? null,
        })
        .returning();
      return plant;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(plants)
        .where(and(eq(plants.id, input.id), eq(plants.userId, ctx.userId)));
    }),

  updatePhoto: protectedProcedure
    .input(z.object({ id: z.number(), photoUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(plants)
        .set({ photoUrl: input.photoUrl, updatedAt: new Date() })
        .where(and(eq(plants.id, input.id), eq(plants.userId, ctx.userId)));
    }),
});
