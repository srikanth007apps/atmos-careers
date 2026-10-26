import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, readJson } from "@/lib/server/http";
import { recalculateApplicationStats } from "@/lib/server/repos/applications";
import { seedDefaultDepartments } from "@/lib/server/repos/departments";

export const runtime = "nodejs";

const schema = z.object({ task: z.enum(["recalculate-stats", "seed-departments"]) });

export async function POST(req: Request) {
  try {
    await requireAdminApi(req);
    const { task } = schema.parse(await readJson(req));
    if (task === "recalculate-stats") return NextResponse.json({ ok: true, stats: await recalculateApplicationStats() });
    return NextResponse.json({ ok: true, ...(await seedDefaultDepartments()) });
  } catch (err) {
    return handleRouteError(err);
  }
}
