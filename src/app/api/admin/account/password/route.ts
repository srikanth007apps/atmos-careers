import { NextResponse } from "next/server";
import { issueSessionCookie, requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, HttpError, readJson } from "@/lib/server/http";
import { verifyPassword } from "@/lib/server/password";
import { getAdmin, setAdminPassword } from "@/lib/server/repos/admins";
import { changePasswordSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const me = await requireAdminApi(req);
    const body = changePasswordSchema.parse(await readJson(req));
    const admin = await getAdmin(me.uid);
    if (!admin || !(await verifyPassword(body.currentPassword, admin.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect.", "wrong_password", { fieldErrors: { currentPassword: "Current password is incorrect." } });
    }
    const ver = await setAdminPassword(me.uid, body.newPassword);
    // Other sessions are now invalid; issue a fresh cookie for this one.
    const cookie = await issueSessionCookie({ uid: me.uid, role: me.role, sessionVersion: ver });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
