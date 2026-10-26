import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/constants";
import { sessionMaxAgeSeconds, signSessionToken, verifySessionToken } from "@/lib/auth/session-token";
import type { AdminUser, SafeAdmin } from "@/lib/types";
import { HttpError } from "./http";
import { getAdmin, toSafeAdmin } from "./repos/admins";

/**
 * Resolve a session cookie to an active admin. The JWT alone is not trusted for authorisation:
 * the admin record must still exist, be active, and match the token's session version.
 */
export async function adminFromToken(token: string | undefined | null): Promise<SafeAdmin | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const admin = await getAdmin(payload.uid);
  if (!admin || !admin.isActive || (admin.sessionVersion ?? 1) !== payload.ver) return null;
  return toSafeAdmin(admin);
}

/** For server components (pages/layouts). Redirects to the login page when not authorised. */
export async function requireAdminPage(): Promise<SafeAdmin> {
  const store = await cookies();
  const admin = await adminFromToken(store.get(SESSION_COOKIE)?.value);
  if (!admin) {
    const path = (await headers()).get("x-pathname") ?? "/admin/dashboard";
    redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  }
  return admin;
}

/** For route handlers. Throws a 401 HttpError when the request is not from an active admin. */
export async function requireAdminApi(req: Request): Promise<SafeAdmin> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const admin = await adminFromToken(token ? decodeURIComponent(token) : null);
  if (!admin) throw new HttpError(401, "Your session has expired. Please sign in again.", "unauthorized");
  return admin;
}

export async function issueSessionCookie(admin: Pick<AdminUser, "uid" | "role" | "sessionVersion">) {
  const token = await signSessionToken({ uid: admin.uid, role: admin.role, ver: admin.sessionVersion ?? 1 });
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: sessionMaxAgeSeconds(),
    },
  };
}

export const clearedSessionCookie = {
  name: SESSION_COOKIE,
  value: "",
  options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0 },
};
