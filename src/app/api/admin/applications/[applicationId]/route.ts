import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/auth";
import { canNotifyStatus, isEmailConfigured, sendStatusUpdate } from "@/lib/server/email";
import { handleRouteError, HttpError, readJson } from "@/lib/server/http";
import {
  getApplication,
  getStatusHistory,
  setHistoryEmailStatus,
  updateApplication,
} from "@/lib/server/repos/applications";
import { getSettings } from "@/lib/server/repos/settings";
import { applicationUpdateSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ applicationId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdminApi(req);
    const { applicationId } = await params;
    const application = await getApplication(applicationId);
    if (!application) throw new HttpError(404, "Application not found.");
    // The stored Cloudinary URL is never sent to the browser – downloads go through the resume endpoint.
    const { resumeUrl: _hidden, searchText: _s, ...safe } = application;
    void _hidden;
    void _s;
    return NextResponse.json({ ok: true, application: safe, history: await getStatusHistory(applicationId) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdminApi(req);
    const { applicationId } = await params;
    const body = applicationUpdateSchema.parse(await readJson(req));
    const { application, previousStatus, historyId } = await updateApplication(
      applicationId,
      { status: body.status, note: body.note, recruiterNotes: body.recruiterNotes },
      admin,
    );

    let email: "sent" | "failed" | "skipped" = "skipped";
    if (historyId && body.notifyCandidate && body.status && canNotifyStatus(body.status)) {
      const settings = await getSettings();
      if (isEmailConfigured() && settings.notifications.sendStatusUpdates) {
        email = await sendStatusUpdate(application.email, application.candidateName, application.jobTitleSnapshot, body.status);
      }
      await setHistoryEmailStatus(applicationId, historyId, email);
    }
    return NextResponse.json({ ok: true, status: application.status, previousStatus, email });
  } catch (err) {
    return handleRouteError(err);
  }
}
