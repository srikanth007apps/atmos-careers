import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JobActions } from "@/components/admin/job-actions";
import { JobStatusBadge } from "@/components/admin/status-badge";
import { JobMeta } from "@/components/public/job-meta";
import { requireAdminPage } from "@/lib/server/auth";
import { getApplicationStats } from "@/lib/server/repos/applications";
import { getDepartment } from "@/lib/server/repos/departments";
import { getJob } from "@/lib/server/repos/jobs";

export const dynamic = "force-dynamic";

export default async function PreviewJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  await requireAdminPage();
  const job = await getJob((await params).jobId);
  if (!job) notFound();
  const [dept, stats] = await Promise.all([getDepartment(job.departmentId), getApplicationStats()]);
  const publicShape = { ...job, departmentName: dept?.name ?? "Unknown", publishedAt: job.publishedAt ?? job.updatedAt };
  return (
    <>
      <Link href="/admin/jobs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-canopy">
        <ArrowLeft className="size-4" /> Manage jobs
      </Link>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-jacaranda/50 bg-[#f3f0fa] px-5 py-3">
        <p className="flex items-center gap-3 text-sm font-semibold text-[#4f3f8c]">
          Preview – this is how candidates will see the job. <JobStatusBadge status={job.status} />
        </p>
        <JobActions jobId={job.id} title={job.title} status={job.status} applications={Number(stats.byJob[job.id] ?? 0)} afterDelete="list" />
      </div>
      <div className="rounded-lg border bg-background p-6 sm:p-10">
        <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
          <article>
            <p className="text-sm font-semibold text-moss">{publicShape.departmentName}</p>
            <h1 className="mt-2 text-4xl font-normal text-canopy">{job.title}</h1>
            <div className="prose-job mt-8" dangerouslySetInnerHTML={{ __html: job.description }} />
          </article>
          <aside className="self-start rounded-lg border bg-card p-5"><JobMeta job={publicShape} /></aside>
        </div>
      </div>
    </>
  );
}
