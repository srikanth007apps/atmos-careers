import { NextResponse } from "next/server";
import { JOB_STATUSES, type JobStatus } from "@/lib/constants";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, readJson } from "@/lib/server/http";
import { createJob, queryJobs } from "@/lib/server/repos/jobs";
import { toInt } from "@/lib/utils";
import { jobSaveSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireAdminApi(req);
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") as JobStatus | null;
    const result = await queryJobs({
      q: sp.get("q") ?? undefined,
      departmentId: sp.get("department") ?? undefined,
      status: status && JOB_STATUSES.includes(status) ? status : "",
      page: toInt(sp.get("page")),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi(req);
    const { intent, ...input } = jobSaveSchema.parse(await readJson(req));
    const job = await createJob(input, intent, admin.uid);
    return NextResponse.json({ ok: true, job }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
