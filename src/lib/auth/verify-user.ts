import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";

export type UserVerificationStatus =
  | { status: "ok"; email: string }
  | { status: "unverified"; email: string }
  | { status: "missing" }
  | { status: "error" };

export async function getUserVerificationStatus(
  userId: string,
): Promise<UserVerificationStatus> {
  try {
    const rows = await db
      .select({
        email: usersTable.email,
        verified_at: usersTable.verified_at,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return { status: "missing" };
    }

    if (!user.verified_at) {
      return { status: "unverified", email: user.email };
    }

    return { status: "ok", email: user.email };
  } catch (error) {
    console.error("[Auth Verify User] Database error:", error);
    return { status: "error" };
  }
}
