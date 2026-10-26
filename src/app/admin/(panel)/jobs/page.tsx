import Link from "next/link";
import { Suspense } from "react";
import { FilePlus2 } from "lucide-react";
import { AdminFilters } from "@/components/admin/admin-filters";
import { JobActions } from "@/components/admin/job-actions";
import { PageHeader } from "@/components/admin/page-header";
import { JobStatusBadge } from "@/components/admin/status-badge";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EMPLOYMENT_TYPE_LABELS, JOB_STATUS_LABELS, JOB_STATUSES, type JobStatus } from "@/lib/constants";
import { isDeadlinePassed } from "@/lib/job-rules";
import { requireAdminPage } from "@/lib/server/auth";
import { getApplicationStats } from "@/lib/server/repos/applications";
import { listDepartments } from "@/lib/server/repos/departments";
import { queryJobs } from "@/lib/server/repos/jobs";
import { formatDate, toInt } from "@/lib/utils";

export const dynamic = "force-dynamic";
type SP = Record<string, string | string[] | undefined>;
const str = (v: SP[string]) => (typeof v === "string" ? v : "");

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = str(sp.status) as JobStatus;
  const [result, departments, stats] = await Promise.all([
    queryJobs({ q: str(sp.q), departmentId: str(sp.department), status: JOB_STATUSES.includes(status) ? status : "", page: toInt(sp.page) }),
    listDepartments(),
    getApplicationStats(),
  ]);
  const deptNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const filtered = !!(str(sp.q) || str(sp.department) || str(sp.status));

  return (
    <>
      <PageHeader
        title="Manage jobs"
        description="Create, publish and close job postings."
        actions={<Button asChild><Link href="/admin/jobs/new"><FilePlus2 /> Post a job</Link></Button>}
      />
      <Suspense>
        <AdminFilters
          searchPlaceholder="Search by job title or location"
          selects={[
            { key: "department", label: "Department", allLabel: "All departments", options: departments.map((d) => ({ value: d.id, label: d.name })) },
            { key: "status", label: "Status", allLabel: "All statuses", options: JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s] })) },
          ]}
        />
      </Suspense>

      <div className="rounded-lg border bg-card">
        {result.items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">{filtered ? "No jobs match these filters" : "No job postings yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered ? "Try clearing a filter." : "Post your first opening – it stays a draft until you publish it."}
            </p>
            {!filtered && <Button asChild className="mt-5"><Link href="/admin/jobs/new">Post a job</Link></Button>}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Applications</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((job) => {
                const apps = Number(stats.byJob[job.id] ?? 0);
                return (
                  <TableRow key={job.id}>
                    <TableCell className="min-w-[200px]">
                      <Link href={`/admin/jobs/${job.id}/edit`} className="font-semibold hover:underline">{job.title}</Link>
                      <p className="text-xs text-muted-foreground">
                        {[job.employmentType && EMPLOYMENT_TYPE_LABELS[job.employmentType], job.location].filter(Boolean).join(", ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{deptNames[job.departmentId] ?? "Unknown"}</TableCell>
                    <TableCell><JobStatusBadge status={job.status} expired={isDeadlinePassed(job)} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {apps > 0 ? <Link className="font-semibold text-canopy hover:underline" href={`/admin/applications?job=${job.id}`}>{apps}</Link> : 0}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(job.applicationDeadline)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(job.updatedAt)}</TableCell>
                    <TableCell className="min-w-[260px]"><JobActions jobId={job.id} title={job.title} status={job.status} applications={apps} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <Pagination base="/admin/jobs" searchParams={sp} page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </>
  );
}
