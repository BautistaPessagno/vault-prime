import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface LockoutStatus {
  locked: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
}

export async function checkLockout(userId: string): Promise<LockoutStatus> {
  const rows = await db
    .select({
      failed_login_attempts: usersTable.failed_login_attempts,
      locked_until: usersTable.locked_until,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return { locked: false, lockedUntil: null, failedAttempts: 0 };
  }

  const now = new Date();
  if (user.locked_until && user.locked_until > now) {
    return {
      locked: true,
      lockedUntil: user.locked_until,
      failedAttempts: user.failed_login_attempts ?? 0,
    };
  }

  // If lockout expired, clear it
  if (user.locked_until && user.locked_until <= now) {
    await clearFailedLogins(userId);
    return { locked: false, lockedUntil: null, failedAttempts: 0 };
  }

  return {
    locked: false,
    lockedUntil: null,
    failedAttempts: user.failed_login_attempts ?? 0,
  };
}

export async function recordFailedLogin(userId: string): Promise<LockoutStatus> {
  // Increment failed attempts
  await db
    .update(usersTable)
    .set({
      failed_login_attempts: sql`COALESCE(${usersTable.failed_login_attempts}, 0) + 1`,
    })
    .where(eq(usersTable.id, userId));

  // Get updated count
  const rows = await db
    .select({
      failed_login_attempts: usersTable.failed_login_attempts,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const failedAttempts = rows[0]?.failed_login_attempts ?? 0;

  // Lock account if exceeded threshold
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await db
      .update(usersTable)
      .set({ locked_until: lockedUntil })
      .where(eq(usersTable.id, userId));

    return { locked: true, lockedUntil, failedAttempts };
  }

  return { locked: false, lockedUntil: null, failedAttempts };
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({
      failed_login_attempts: 0,
      locked_until: null,
    })
    .where(eq(usersTable.id, userId));
}
