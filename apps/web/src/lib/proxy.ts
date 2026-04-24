import { NextRequest, NextResponse } from "next/server";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { verifySessionToken } from "@/src/lib/auth/jwt";

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/verify-email",
  "/verify-email/success",
  "/verify-email/error",
];

/**
 * Routes that should redirect to home if user is authenticated
 */
const AUTH_REDIRECT_ROUTES = ["/login", "/signup"];

/**
 * Proxy handler for authentication and redirects
 */
export async function proxyHandler(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    /\.(png|jpg|jpeg|gif|svg|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get("session")?.value;

  let isAuthenticated = false;

  // Verify token if present
  if (sessionToken) {
    try {
      await verifySessionToken(sessionToken);
      isAuthenticated = true;
    } catch {
      // Token is invalid or expired
      isAuthenticated = false;
    }
  }

  // If authenticated and trying to access auth pages, redirect to home
  if (isAuthenticated && AUTH_REDIRECT_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If not authenticated and trying to access protected routes, redirect to login
  if (!isAuthenticated && !PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Dev keeps 'unsafe-inline' because HMR / React Refresh inject inline
  // scripts without nonces. Production uses a per-request nonce +
  // 'strict-dynamic' so any XSS payload cannot execute inline scripts.
  const isProd = process.env.NODE_ENV === "production";
  const nonce = isProd ? bytesToHex(randomBytes(16)) : "";
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;

  const csp = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' https://vitals.vercel-insights.com https://*.vercel-analytics.com`,
    `frame-src 'self' https://vercel.live`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
  }
  // Next.js reads this request header to auto-propagate the nonce onto its
  // own injected scripts (__NEXT_DATA__, chunks, etc).
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

/**
 * Matcher configuration for Next.js middleware
 * This should be exported from middleware.ts if used as Next.js middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
