import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, readJson } from "@/lib/server/http";
import { changeJobStatus } from "@/lib/server/repos/jobs";
import { jobStatusActionSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    await requireAdminApi(req);
    const { action } = jobStatusActionSchema.parse(await readJson(req));
    const job = await changeJobStatus((await params).jobId, action);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return handleRouteError(err);
  }
}
