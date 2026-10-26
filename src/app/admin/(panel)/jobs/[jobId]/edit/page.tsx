import { notFound } from "next/navigation";
import { JobActions } from "@/components/admin/job-actions";
import { JobForm } from "@/components/admin/job-form";
import { PageHeader } from "@/components/admin/page-header";
import { JobStatusBadge } from "@/components/admin/status-badge";
import { deadlineToDateInput, isDeadlinePassed } from "@/lib/job-rules";
import { requireAdminPage } from "@/lib/server/auth";
import { getApplicationStats } from "@/lib/server/repos/applications";
import { listDepartments } from "@/lib/server/repos/departments";
import { getJob } from "@/lib/server/repos/jobs";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  await requireAdminPage();
  const { jobId } = await params;
  const [job, departments, stats] = await Promise.all([getJob(jobId), listDepartments(), getApplicationStats()]);
  if (!job) notFound();
  return (
    <>
      <PageHeader title="Edit job" description={`Created ${formatDateTime(job.createdAt)}, last updated ${formatDateTime(job.updatedAt)}`} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3">
        <JobStatusBadge status={job.status} expired={isDeadlinePassed(job)} />
        <JobActions jobId={job.id} title={job.title} status={job.status} applications={Number(stats.byJob[job.id] ?? 0)} variant="page" afterDelete="list" showEdit={false} />
      </div>
      <JobForm
        mode="edit"
        jobId={job.id}
        status={job.status}
        departments={departments}
        defaults={{
          title: job.title,
          description: job.description,
          departmentId: job.departmentId,
          employmentType: job.employmentType ?? "",
          location: job.location ?? "",
          vacancies: job.vacancies ? String(job.vacancies) : "",
          applicationDeadline: deadlineToDateInput(job.applicationDeadline),
        }}
      />
    </>
  );
}
