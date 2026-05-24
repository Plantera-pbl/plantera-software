import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db } from "@/server/db";
import { deviceConfigs, plants } from "@/server/db/schema";

const quietWindowSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm"),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm"),
});

const DEFAULT_CONFIG = {
  wateringCooldownMin: 30,
  wateringOnPct: 35,
  wateringOffPct: 60,
  wateringDurationSec: 20,
  fanOnPct: 75,
  fanOffPct: 60,
  lightOnPct: 30,
  lightOffPct: 55,
  quietHours: [] as { start: string; end: string }[],
  timezoneOffsetMin: 0,
  deviceOn: true,
};

async function assertOwnsPlant(
  ctx: { db: typeof db; userId: string },
  plantId: number,
) {
  const rows = await ctx.db
    .select({ id: plants.id })
    .from(plants)
    .where(and(eq(plants.id, plantId), eq(plants.userId, ctx.userId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error("Plant not found or access denied");
  }
}

export const configRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ plantId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertOwnsPlant(ctx, input.plantId);
      const [row] = await ctx.db
        .select()
        .from(deviceConfigs)
        .where(eq(deviceConfigs.plantId, input.plantId))
        .limit(1);
      if (!row) return { plantId: input.plantId, ...DEFAULT_CONFIG };
      return row;
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        plantId: z.number().int(),
        wateringCooldownMin: z.number().int().min(0).max(720),
        wateringOnPct: z.number().int().min(0).max(100),
        wateringOffPct: z.number().int().min(0).max(100),
        wateringDurationSec: z.number().int().min(1).max(600),
        fanOnPct: z.number().int().min(0).max(100),
        fanOffPct: z.number().int().min(0).max(100),
        lightOnPct: z.number().int().min(0).max(100),
        lightOffPct: z.number().int().min(0).max(100),
        quietHours: z.array(quietWindowSchema).max(8),
        timezoneOffsetMin: z.number().int().min(-840).max(840),
        deviceOn: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsPlant(ctx, input.plantId);
      const { plantId, ...values } = input;

      const [existing] = await ctx.db
        .select({ id: deviceConfigs.id })
        .from(deviceConfigs)
        .where(eq(deviceConfigs.plantId, plantId))
        .limit(1);

      if (existing) {
        await ctx.db
          .update(deviceConfigs)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(deviceConfigs.id, existing.id));
      } else {
        await ctx.db.insert(deviceConfigs).values({
          plantId,
          userId: ctx.userId,
          ...values,
        });
      }
    }),
});
