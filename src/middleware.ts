import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifySessionToken } from "@/lib/auth/session-token";
import { isSameOrigin } from "@/lib/auth/origin";

/**
 * First line of defence for the admin area:
 *  - rejects requests without a valid, unexpired session token
 *  - blocks cross-site state-changing requests (CSRF) on admin APIs
 * Every page and API handler re-validates the admin against the database as well.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  if (isAdminApi && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !isSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Cross-site request blocked." }, { status: 403 });
  }

  if (isAdminApi || isAdminPage) {
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      if (isAdminApi) {
        return NextResponse.json({ ok: false, error: "Your session has expired. Please sign in again.", code: "unauthorized" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      const res = NextResponse.redirect(url);
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
  }

  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  if (pathname.startsWith("/admin") || isAdminApi) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}


export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
