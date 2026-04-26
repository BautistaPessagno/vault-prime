import { NextResponse } from "next/server";
import { getSessionData } from "@/src/lib/entries/crypto";
import { checkRateLimit } from "@/src/lib/security/rate-limit";

const ICON_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxAttempts: 120,
  keyPrefix: "ratelimit:icon:",
};

const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function isBlockedHost(host: string): boolean {
  if (host === "localhost") return true;
  if (host.endsWith(".local") || host.endsWith(".localhost")) return true;
  if (host.includes(":")) return true;
  if (IPV4_RE.test(host)) return true;
  return false;
}

function notFound(): NextResponse {
  return new NextResponse("not_found", { status: 404 });
}

export async function GET(req: Request) {
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(session.userId, ICON_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!raw || raw.length > 253) {
    return notFound();
  }

  let host = "";
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return notFound();
  }

  if (!host || !HOSTNAME_RE.test(host) || isBlockedHost(host)) {
    return notFound();
  }

  const upstream = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;

  try {
    const res = await fetch(upstream, {
      signal: AbortSignal.timeout(3000),
      redirect: "follow",
    });
    if (!res.ok) {
      return notFound();
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) {
      return notFound();
    }
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
