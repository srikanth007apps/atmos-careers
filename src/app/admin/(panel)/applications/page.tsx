import { Suspense } from "react";
import { AdminFilters } from "@/components/admin/admin-filters";
import { ApplicationsTable } from "@/components/admin/applications-table";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/pagination";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/constants";
import { parseDateRange } from "@/lib/date-range";
import { requireAdminPage } from "@/lib/server/auth";
import { queryApplications } from "@/lib/server/repos/applications";
import { listDepartments } from "@/lib/server/repos/departments";
import { listAllJobs } from "@/lib/server/repos/jobs";
import { toInt } from "@/lib/utils";

export const dynamic = "force-dynamic";
type SP = Record<string, string | string[] | undefined>;
const str = (v: SP[string]) => (typeof v === "string" ? v : "");

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = str(sp.status) as ApplicationStatus;
  const { from, to } = parseDateRange(str(sp.from), str(sp.to));
  const [result, departments, jobs] = await Promise.all([
    queryApplications({
      q: str(sp.q),
      jobId: str(sp.job),
      departmentId: str(sp.department),
      status: APPLICATION_STATUSES.includes(status) ? status : "",
      from,
      to,
      page: toInt(sp.page),
    }),
    listDepartments(),
    listAllJobs(),
  ]);
  const deptNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const filtered = [...Object.keys(sp)].some((k) => k !== "page" && str(sp[k]));

  return (
    <>
      <PageHeader title="Candidate applications" description="Search, filter and review everyone who has applied." />
      <Suspense>
        <AdminFilters
          searchPlaceholder="Search name, email, phone or job title"
          dateRange
          selects={[
            { key: "job", label: "Job posting", allLabel: "All jobs", options: jobs.map((j) => ({ value: j.id, label: j.status === "closed" ? `${j.title} (closed)` : j.title })) },
            { key: "department", label: "Department", allLabel: "All departments", options: departments.map((d) => ({ value: d.id, label: d.name })) },
            { key: "status", label: "Status", allLabel: "All statuses", options: APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] })) },
          ]}
        />
      </Suspense>
      <div className="rounded-lg border bg-card">
        {result.items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">{filtered ? "No applications match these filters" : "No applications yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered ? "Try a different search or clear the filters." : "When candidates apply to published jobs, they'll appear here."}
            </p>
          </div>
        ) : (
          <ApplicationsTable items={result.items} departments={deptNames} />
        )}
      </div>
      <Pagination base="/admin/applications" searchParams={sp} page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </>
  );
}
