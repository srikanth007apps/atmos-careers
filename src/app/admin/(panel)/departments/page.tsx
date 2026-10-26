import { DepartmentsManager } from "@/components/admin/departments-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/server/auth";
import { listDepartments } from "@/lib/server/repos/departments";
import { listAllJobs } from "@/lib/server/repos/jobs";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  await requireAdminPage();
  const [departments, jobs] = await Promise.all([listDepartments(), listAllJobs()]);
  const rows = departments.map((d) => {
    const own = jobs.filter((j) => j.departmentId === d.id);
    return { id: d.id, name: d.name, isActive: d.isActive, jobCount: own.length, openJobs: own.filter((j) => j.status === "published").length };
  });
  return (
    <>
      <PageHeader title="Departments" description="Departments appear in the job form and as a filter on the careers site." />
      <DepartmentsManager rows={rows} />
    </>
  );
}
