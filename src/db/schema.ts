import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  master_password_hash: text("master_password_hash").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const entriesTable = pgTable("entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  nombre: text("name").notNull(),
  usuario: text("user").notNull(),
  password: text("password").notNull(),
  url: text("url").notNull(),
  last_edited: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  last_copied: timestamp("copied_at", { withTimezone: true, mode: "string" }),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type InsertEntry = typeof entriesTable.$inferInsert;
export type SelectEntry = typeof entriesTable.$inferSelect;
