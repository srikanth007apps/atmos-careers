import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, HttpError, readJson } from "@/lib/server/http";
import { deleteJob, getJob, updateJob } from "@/lib/server/repos/jobs";
import { jobInputSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ jobId: string }> };

const updateSchema = jobInputSchema.extend({ intent: z.enum(["draft", "publish", "keep"]).default("keep") });

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdminApi(req);
    const job = await getJob((await params).jobId);
    if (!job) throw new HttpError(404, "Job not found.");
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdminApi(req);
    const { intent, ...input } = updateSchema.parse(await readJson(req));
    const job = await updateJob((await params).jobId, input, intent, admin.uid);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireAdminApi(req);
    await deleteJob((await params).jobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
