import { db } from "@/src/db";
import { auditLogsTable } from "@/src/db/schema";

export type AuditEventType =
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "signup"
  | "signup_failed"
  | "email_verified"
  | "email_verification_failed"
  | "email_verification_max_attempts"
  | "logout"
  | "password_changed"
  | "account_deleted";

interface AuditEventParams {
  userId?: string | null;
  eventType: AuditEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      user_id: params.userId ?? null,
      event_type: params.eventType,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (error) {
    console.error("[Audit Log] Failed to log event:", error);
  }
}

export function getClientIp(request: Request): string | null {
  // Check common headers for proxied requests
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // Take the first IP if multiple are present
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }

  // Vercel-specific header
  const xVercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (xVercelForwardedFor) {
    return xVercelForwardedFor.split(",")[0].trim();
  }

  return null;
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}
