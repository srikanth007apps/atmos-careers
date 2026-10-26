import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/auth";
import { createResumeDownloadUrl } from "@/lib/server/cloudinary";
import { handleRouteError, HttpError } from "@/lib/server/http";
import { getApplication } from "@/lib/server/repos/applications";

export const runtime = "nodejs";

/**
 * Authorised resume access: verifies the admin, then redirects to a Cloudinary
 * download link that expires in 60 seconds. ?view=1 opens inline (for the PDF preview).
 */
export async function GET(req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  try {
    await requireAdminApi(req);
    const application = await getApplication((await params).applicationId);
    if (!application?.resumePath) throw new HttpError(404, "Resume not found.");
    const inline = new URL(req.url).searchParams.get("view") === "1";
    const url = createResumeDownloadUrl(application.resumePath, 60, !inline);
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
