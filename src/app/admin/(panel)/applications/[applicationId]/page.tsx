import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, Mail, Phone } from "lucide-react";
import { RecruiterNotes, StatusUpdater } from "@/components/admin/application-review";
import { ApplicationStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { requireAdminPage } from "@/lib/server/auth";
import { isEmailConfigured } from "@/lib/server/email";
import { getApplication, getStatusHistory } from "@/lib/server/repos/applications";
import { getDepartment } from "@/lib/server/repos/departments";
import { getJob } from "@/lib/server/repos/jobs";
import { getSettings } from "@/lib/server/repos/settings";
import { formatBytes, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  await requireAdminPage();
  const { applicationId } = await params;
  const app = await getApplication(applicationId);
  if (!app) notFound();
  const [history, dept, job, settings] = await Promise.all([
    getStatusHistory(app.id),
    getDepartment(app.departmentIdSnapshot),
    getJob(app.jobId),
    getSettings(),
  ]);
  const emailAvailable = isEmailConfigured() && settings.notifications.sendStatusUpdates;

  return (
    <>
      <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-canopy">
        <ArrowLeft className="size-4" /> Candidate applications
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal text-canopy">{app.candidateName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Applied for{" "}
            {job ? (
              <Link className="font-semibold text-foreground hover:underline" href={`/admin/jobs/${job.id}/edit`}>{app.jobTitleSnapshot}</Link>
            ) : (
              <span className="font-semibold text-foreground">{app.jobTitleSnapshot} (job deleted)</span>
            )}{" "}
            in {dept?.name ?? "an unknown department"} on {formatDateTime(app.appliedAt)}
          </p>
        </div>
        <ApplicationStatusBadge status={app.status} className="px-3 py-1 text-sm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <a href={`mailto:${app.email}`} className="flex items-center gap-2.5 text-sm font-semibold hover:underline"><Mail className="size-4 text-moss" />{app.email}</a>
              <a href={`tel:${app.phone}`} className="flex items-center gap-2.5 text-sm font-semibold hover:underline"><Phone className="size-4 text-moss" />{app.phone}</a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Message from the candidate</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-line leading-relaxed text-foreground/90">{app.message}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <FileText className="size-8 text-moss" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{app.resumeFileName}</p>
                <p className="text-xs text-muted-foreground">{app.resumeFormat?.toUpperCase()}, {formatBytes(app.resumeSize)}</p>
              </div>
              <div className="flex gap-2">
                {app.resumeFormat === "pdf" && (
                  <Button asChild variant="outline">
                    <a href={`/api/admin/applications/${app.id}/resume?view=1`} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open</a>
                  </Button>
                )}
                <Button asChild>
                  <a href={`/api/admin/applications/${app.id}/resume`}><Download /> Download</a>
                </Button>
              </div>
              <p className="w-full text-xs text-muted-foreground">Links are generated for your session and expire after 60 seconds.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recruiter notes</CardTitle></CardHeader>
            <CardContent><RecruiterNotes applicationId={app.id} initial={app.recruiterNotes ?? ""} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Update status</CardTitle></CardHeader>
            <CardContent><StatusUpdater applicationId={app.id} current={app.status} emailAvailable={emailAvailable} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l pl-5">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-card bg-moss" aria-hidden />
                    <p className="text-sm font-semibold">
                      {h.previousStatus ? `${APPLICATION_STATUS_LABELS[h.previousStatus]} to ${APPLICATION_STATUS_LABELS[h.newStatus]}` : APPLICATION_STATUS_LABELS[h.newStatus]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.changedAt)}, by {h.changedBy === "candidate" ? "candidate" : (h.changedByName ?? h.changedBy)}
                    </p>
                    {h.note && <p className="mt-1 text-sm text-foreground/80">{h.note}</p>}
                    {h.emailStatus && h.emailStatus !== "skipped" && (
                      <p className={`mt-1 text-xs ${h.emailStatus === "sent" ? "text-moss" : "text-destructive"}`}>
                        {h.emailStatus === "sent" ? "Candidate emailed" : "Email to candidate failed"}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
