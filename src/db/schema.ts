import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  master_password_hash: text("master_password_hash").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  verified_at: timestamp("verified_at", { withTimezone: true, mode: "date" }),
});

export const entriesTable = pgTable("entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  username: text("user").notNull(),
  password: text("password").notNull(),
  url: text("url").notNull(),
  last_edited: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  last_copied: timestamp("copied_at", { withTimezone: true, mode: "string" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }),
});

export const emailVerificationCodesTable = pgTable("email_verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  code: text("code").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  expires_at: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  attempts: integer("attempts").notNull().default(0),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type InsertEntry = typeof entriesTable.$inferInsert;
export type SelectEntry = typeof entriesTable.$inferSelect;
