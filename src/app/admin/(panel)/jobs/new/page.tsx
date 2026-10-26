import { JobForm } from "@/components/admin/job-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/server/auth";
import { listDepartments } from "@/lib/server/repos/departments";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  await requireAdminPage();
  const departments = await listDepartments({ activeOnly: true });
  return (
    <>
      <PageHeader title="Post a job" description="Fill in the details, then publish it or save it as a draft." />
      <JobForm
        mode="create"
        departments={departments}
        defaults={{ title: "", description: "", departmentId: "", employmentType: "", location: "", vacancies: "", applicationDeadline: "" }}
      />
    </>
  );
}
