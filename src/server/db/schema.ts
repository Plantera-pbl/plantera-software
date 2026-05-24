// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { index, pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator(
  (name) => `plantera-software_${name}`,
);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)],
);

export const plants = createTable(
  "plant",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d.varchar({ length: 256 }).notNull(),
    name: d.varchar({ length: 256 }).notNull(),
    species: d.varchar({ length: 256 }),
    topic: d.varchar({ length: 512 }),
    photoUrl: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("plant_user_idx").on(t.userId)],
);

export const notifications = createTable(
  "notification",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d.varchar({ length: 256 }).notNull(),
    plantId: d.integer(),
    category: d.varchar({ length: 64 }).notNull().default("info"),
    severity: d.varchar({ length: 16 }).notNull().default("info"),
    title: d.varchar({ length: 512 }).notNull(),
    body: d.text().notNull(),
    read: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("notif_user_idx").on(t.userId)],
);

/**
 * Per-plant device configuration. Stores threshold values used by the
 * notification engine to decide when watering / fan / grow-light cycles
 * are "on" vs "off". Times are stored in plain HH:mm strings (24h) and
 * `quietHours` is a JSON array of `{ start, end }` entries.
 */
export const deviceConfigs = createTable(
  "device_config",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    plantId: d.integer().notNull().unique(),
    userId: d.varchar({ length: 256 }).notNull(),

    // cooldown between two notifications of the same kind for the same plant
    wateringCooldownMin: d.integer().notNull().default(30),

    // watering thresholds
    wateringOnPct: d.integer().notNull().default(35),
    wateringOffPct: d.integer().notNull().default(60),
    wateringDurationSec: d.integer().notNull().default(20),

    // fan / humidity thresholds  (ON when humidity climbs above OnPct)
    fanOnPct: d.integer().notNull().default(75),
    fanOffPct: d.integer().notNull().default(60),

    // grow-light thresholds (ON when ambient light drops below OnPct)
    lightOnPct: d.integer().notNull().default(30),
    lightOffPct: d.integer().notNull().default(55),

    // JSON: [{ start: "22:00", end: "07:00" }, ...]
    quietHours: d.jsonb().notNull().default([]),
    timezoneOffsetMin: d.integer().notNull().default(0),

    // master device state (1 = on, 0 = off)
    deviceOn: d.boolean().notNull().default(true),

    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("device_config_user_idx").on(t.userId)],
);

/**
 * User-scheduled reminders (e.g. "fertilise in 30 days"). The notification
 * engine emits a notification when `dueAt` passes and marks `done = true`.
 */
export const reminders = createTable(
  "reminder",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d.varchar({ length: 256 }).notNull(),
    plantId: d.integer(),
    title: d.varchar({ length: 256 }).notNull(),
    note: d.text(),
    dueAt: d.timestamp({ withTimezone: true }).notNull(),
    done: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("reminder_user_idx").on(t.userId)],
);
