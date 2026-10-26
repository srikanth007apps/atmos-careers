import { NextResponse } from "next/server";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/constants";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError } from "@/lib/server/http";
import { queryApplications } from "@/lib/server/repos/applications";
import { parseDateRange } from "@/lib/date-range";
import { toInt } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireAdminApi(req);
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") as ApplicationStatus | null;
    const { from, to } = parseDateRange(sp.get("from"), sp.get("to"));
    const result = await queryApplications({
      q: sp.get("q") ?? undefined,
      jobId: sp.get("job") ?? undefined,
      departmentId: sp.get("department") ?? undefined,
      status: status && APPLICATION_STATUSES.includes(status) ? status : "",
      from,
      to,
      page: toInt(sp.get("page")),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}
