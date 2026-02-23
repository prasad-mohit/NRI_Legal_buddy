import { NextResponse, type NextRequest } from "next/server";

import { logEvent } from "@/server/logger";

const PRIVATE_SHORT_CACHE = "private, max-age=20, stale-while-revalidate=40";
const NO_STORE = "no-store";

const shouldUsePrivateCache = (pathname: string) =>
  pathname.startsWith("/api/cases") ||
  pathname.startsWith("/api/tickets") ||
  pathname.startsWith("/api/meetings");

const shouldForceNoStore = (pathname: string) =>
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/api/admin") ||
  pathname.startsWith("/api/payments");

const shouldLogRequest = (method: string, pathname: string) =>
  method !== "GET" ||
  pathname.startsWith("/api/tickets") ||
  pathname.startsWith("/api/admin/tickets") ||
  pathname.startsWith("/api/admin/export") ||
  pathname.startsWith("/api/admin/monitoring");

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const res = NextResponse.next();
  const cacheControl =
    method === "GET" && !shouldForceNoStore(pathname) && shouldUsePrivateCache(pathname)
      ? PRIVATE_SHORT_CACHE
      : NO_STORE;

  res.headers.set("x-request-id", requestId);
  res.headers.set("Cache-Control", cacheControl);
  res.headers.set("Vary", "Cookie, Accept-Encoding");
  res.headers.set("x-cache-policy", cacheControl === NO_STORE ? "no-store" : "private-short");

  if (shouldLogRequest(method, pathname)) {
    logEvent("info", "http.request", {
      requestId,
      method,
      path: pathname,
      cacheControl,
    });
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
