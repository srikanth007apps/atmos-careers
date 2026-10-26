import { NextResponse } from "next/server";
import { validateResumeMeta } from "@/lib/file-validation";
import { CLOSED_MESSAGES, whyJobNotAccepting } from "@/lib/job-rules";
import { createResumeUploadSignature } from "@/lib/server/cloudinary";
import { serverEnv } from "@/lib/server/env";
import { clientIp, handleRouteError, HttpError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { getJob } from "@/lib/server/repos/jobs";
import { uploadSignatureSchema } from "@/lib/validation/application";

export const runtime = "nodejs";

/** Step 1 of an application: validate the file metadata and return a one-time signed upload. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit("upload-sign", clientIp(req), 20, 10 * 60 * 1000))) {
      throw new HttpError(429, "Too many upload attempts. Please wait a few minutes and try again.");
    }
    const body = uploadSignatureSchema.parse(await readJson(req));
    const job = await getJob(body.jobId);
    const reason = whyJobNotAccepting(job);
    if (reason) throw new HttpError(reason === "not_found" ? 404 : 410, CLOSED_MESSAGES[reason], reason);

    const check = validateResumeMeta(
      { name: body.fileName, size: body.fileSize, type: body.fileType },
      { maxBytes: serverEnv.resume.maxBytes, allowWord: serverEnv.resume.allowWord },
    );
    if (!check.ok) throw new HttpError(400, check.error, "invalid_file");

    const signed = createResumeUploadSignature(body.jobId, check.kind);
    return NextResponse.json({ ok: true, ...signed });
  } catch (err) {
    return handleRouteError(err);
  }
}
