import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { ApplicationsTable } from "@/components/admin/applications-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/server/auth";
import { getApplicationStats, recentApplications } from "@/lib/server/repos/applications";
import { departmentNameMap } from "@/lib/server/repos/departments";
import { listAllJobs } from "@/lib/server/repos/jobs";

export const dynamic = "force-dynamic";

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="group block px-5 py-4 hover:bg-accent/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-3xl text-canopy tabular-nums group-hover:underline group-hover:underline-offset-4">{value}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  const [jobs, stats, recent, depts] = await Promise.all([listAllJobs(), getApplicationStats(), recentApplications(8), departmentNameMap()]);
  const count = (s: string) => jobs.filter((j) => j.status === s).length;
  const firstName = (admin.displayName || admin.username).split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Here's where hiring stands today."
        actions={<Button asChild><Link href="/admin/jobs/new"><FilePlus2 /> Post a job</Link></Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[3fr_4fr]">
        <section aria-labelledby="jobs-stats" className="rounded-lg border bg-card">
          <h2 id="jobs-stats" className="border-b px-5 py-3 font-sans text-sm font-semibold">Job postings</h2>
          <div className="grid grid-cols-3 divide-x">
            <Stat label="Total" value={jobs.length} href="/admin/jobs" />
            <Stat label="Published" value={count("published")} href="/admin/jobs?status=published" />
            <Stat label="Drafts" value={count("draft")} href="/admin/jobs?status=draft" />
          </div>
        </section>
        <section aria-labelledby="app-stats" className="rounded-lg border bg-card">
          <h2 id="app-stats" className="border-b px-5 py-3 font-sans text-sm font-semibold">Applications</h2>
          <div className="grid grid-cols-2 divide-x sm:grid-cols-4 [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0">
            <Stat label="Total" value={stats.total} href="/admin/applications" />
            <Stat label="New" value={stats.byStatus.new} href="/admin/applications?status=new" />
            <Stat label="Under review" value={stats.byStatus.under_review} href="/admin/applications?status=under_review" />
            <Stat label="Shortlisted" value={stats.byStatus.shortlisted} href="/admin/applications?status=shortlisted" />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-card" aria-labelledby="recent">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 id="recent" className="font-sans text-sm font-semibold">Recent applications</h2>
          <Link href="/admin/applications" className="text-sm font-semibold text-canopy hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold">No applications yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Publish a job and applications will appear here as candidates apply.</p>
          </div>
        ) : (
          <ApplicationsTable items={recent} departments={depts} compact />
        )}
      </section>
    </>
  );
}
