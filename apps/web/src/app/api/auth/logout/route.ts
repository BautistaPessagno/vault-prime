import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { getKeyCache } from "@/src/lib/cache";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  // Try to delete cached key if session exists
  if (token) {
    try {
      const payload = await verifySessionToken(token);
      const sessionId = typeof payload.sid === "string" ? payload.sid : null;
      if (sessionId) {
        const keyCache = getKeyCache();
        await keyCache.delete(sessionId);
      }
    } catch {
      // Token invalid or expired, nothing to clean up
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}
