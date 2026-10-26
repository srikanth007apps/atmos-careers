import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, readJson } from "@/lib/server/http";
import { getSettings, updateSettings } from "@/lib/server/repos/settings";
import { settingsSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireAdminApi(req);
    return NextResponse.json({ ok: true, settings: await getSettings() });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminApi(req);
    const settings = settingsSchema.parse(await readJson(req));
    await updateSettings(settings);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return handleRouteError(err);
  }
}
