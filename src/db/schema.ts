import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  master_password_hash: text("master_password_hash").notNull(),
  encryption_key: text("encryption_key"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  verified_at: timestamp("verified_at", { withTimezone: true, mode: "date" }),
  failed_login_attempts: integer("failed_login_attempts").default(0),
  locked_until: timestamp("locked_until", { withTimezone: true, mode: "date" }),
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
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const emailVerificationCodesTable = pgTable("email_verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  code_hash: text("code_hash").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  expires_at: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  event_type: text("event_type").notNull(),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  metadata: text("metadata"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type InsertEntry = typeof entriesTable.$inferInsert;
export type SelectEntry = typeof entriesTable.$inferSelect;
