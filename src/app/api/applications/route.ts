import { NextResponse } from "next/server";
import { contentMatchesKind, detectKindFromBytes, RESUME_KINDS, validateResumeMeta } from "@/lib/file-validation";
import { CLOSED_MESSAGES, whyJobNotAccepting } from "@/lib/job-rules";
import { deleteResume, fetchResumeBytes, getResumeResource, isOurResumePublicId } from "@/lib/server/cloudinary";
import { sendApplicationAcknowledgement } from "@/lib/server/email";
import { serverEnv } from "@/lib/server/env";
import { clientIp, handleRouteError, HttpError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createApplication } from "@/lib/server/repos/applications";
import { getJob } from "@/lib/server/repos/jobs";
import { getSettings } from "@/lib/server/repos/settings";
import { applicationSubmissionSchema } from "@/lib/validation/application";

export const runtime = "nodejs";

/** Step 2 of an application: verify the uploaded resume, then save the application. */
export async function POST(req: Request) {
  let uploadedPublicId: string | null = null;
  try {
    if (!(await rateLimit("apply", clientIp(req), 10, 10 * 60 * 1000))) {
      throw new HttpError(429, "Too many submissions from your network. Please wait a few minutes and try again.");
    }
    const data = applicationSubmissionSchema.parse(await readJson(req));

    const job = await getJob(data.jobId);
    const reason = whyJobNotAccepting(job);
    if (reason || !job) throw new HttpError(reason === "not_found" ? 404 : 410, CLOSED_MESSAGES[reason ?? "not_found"], reason ?? "not_found");

    // ── Verify the resume that the browser uploaded to Cloudinary ──
    if (!isOurResumePublicId(data.resume.publicId, data.jobId)) {
      throw new HttpError(400, "Resume upload could not be verified. Please upload the file again.", "invalid_resume");
    }
    const meta = validateResumeMeta(
      { name: data.resume.originalFileName, size: 1, type: "" },
      { maxBytes: serverEnv.resume.maxBytes, allowWord: serverEnv.resume.allowWord },
    );
    if (!meta.ok) throw new HttpError(400, meta.error, "invalid_file");
    const declaredKind = data.resume.publicId.endsWith(".pdf") ? "pdf" : data.resume.publicId.endsWith(".docx") ? "docx" : "doc";

    const stored = await getResumeResource(data.resume.publicId);
    if (!stored) throw new HttpError(400, "We could not find your uploaded resume. Please upload it again.", "resume_missing");
    uploadedPublicId = stored.publicId;
    if (stored.bytes > serverEnv.resume.maxBytes) {
      throw new HttpError(400, `File is too large. Maximum size is ${Math.round(serverEnv.resume.maxBytes / 1048576)} MB.`, "file_too_large");
    }
    const bytes = await fetchResumeBytes(stored.publicId);
    if (!contentMatchesKind(declaredKind, detectKindFromBytes(bytes))) {
      throw new HttpError(400, "The uploaded file is not a valid PDF or Word document.", "invalid_file_content");
    }

    const result = await createApplication(
      {
        jobId: job.id,
        jobTitleSnapshot: job.title,
        departmentIdSnapshot: job.departmentId,
        candidateName: data.candidateName,
        phone: data.phone,
        email: data.email,
        message: data.message,
        resumePath: stored.publicId,
        resumeUrl: stored.url,
        resumeFileName: data.resume.originalFileName,
        resumeContentType: RESUME_KINDS[declaredKind].mime[0],
        resumeSize: stored.bytes,
        resumeFormat: declaredKind,
        consentAt: Date.now(),
      },
      data.idempotencyKey,
    );
    uploadedPublicId = null; // saved – keep the file

    let acknowledgement: "sent" | "failed" | "skipped" = "skipped";
    if (!result.replayed) {
      const settings = await getSettings().catch(() => null);
      if (settings?.notifications.sendAcknowledgement) {
        acknowledgement = await sendApplicationAcknowledgement(data.email, data.candidateName, job.title);
      }
    }
    return NextResponse.json({ ok: true, applicationId: result.id, acknowledgement }, { status: result.replayed ? 200 : 201 });
  } catch (err) {
    // Don't leave orphaned files behind for rejected submissions.
    if (uploadedPublicId) {
      await deleteResume(uploadedPublicId);
    }
    return handleRouteError(err);
  }
}
