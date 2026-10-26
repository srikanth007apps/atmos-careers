import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth/origin";
import { issueSessionCookie } from "@/lib/server/auth";
import { clientIp, handleRouteError, HttpError, readJson } from "@/lib/server/http";
import { burnPasswordCheck, verifyPassword } from "@/lib/server/password";
import { rateLimit } from "@/lib/server/rate-limit";
import {
  clearFailedLogins,
  findAdminByUsername,
  getLoginLock,
  recordLogin,
  registerFailedLogin,
} from "@/lib/server/repos/admins";
import { loginSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

const INVALID = "Invalid username or password.";

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) throw new HttpError(403, "Cross-site request blocked.");
    if (!(await rateLimit("login-ip", clientIp(req), 30, 15 * 60 * 1000))) {
      throw new HttpError(429, "Too many sign-in attempts. Please wait a few minutes and try again.");
    }
    const { username, password } = loginSchema.parse(await readJson(req));

    const lockedUntil = await getLoginLock(username);
    if (lockedUntil) {
      const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
      throw new HttpError(429, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, "locked");
    }

    const admin = await findAdminByUsername(username);
    const valid = admin ? await verifyPassword(password, admin.passwordHash) : await burnPasswordCheck(password);
    if (!admin || !valid) {
      await registerFailedLogin(username);
      throw new HttpError(401, INVALID, "invalid_credentials");
    }
    if (!admin.isActive) throw new HttpError(403, "This admin account has been deactivated.", "inactive");

    await Promise.all([clearFailedLogins(username), recordLogin(admin.uid)]);
    const cookie = await issueSessionCookie(admin);
    const res = NextResponse.json({ ok: true, admin: { displayName: admin.displayName, role: admin.role } });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
