import { relations } from "drizzle-orm/relations";
import { users, entries, emailVerificationCodes } from "./schema";

export const entriesRelations = relations(entries, ({one}) => ({
	user: one(users, {
		fields: [entries.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	entries: many(entries),
	emailVerificationCodes: many(emailVerificationCodes),
}));

export const emailVerificationCodesRelations = relations(emailVerificationCodes, ({one}) => ({
	user: one(users, {
		fields: [emailVerificationCodes.userId],
		references: [users.id]
	}),
}));