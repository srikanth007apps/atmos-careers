import "server-only";
import { PAGE_SIZE, type JobStatus } from "@/lib/constants";
import { deadlineFromDateInput, isDeadlinePassed, isJobPubliclyVisible } from "@/lib/job-rules";
import type { Job, PublicJob } from "@/lib/types";
import { paginate } from "@/lib/utils";
import type { JobInputParsed } from "@/lib/validation/admin";
import { HttpError } from "../http";
import { adminDb, mapToArray, newId, withIndexFallback } from "../firebase-admin";
import { sanitizeJobHtml } from "../sanitize";
import { getDepartment } from "./departments";

export async function getJob(id: string): Promise<Job | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const snap = await (await adminDb()).ref(`jobs/${id}`).get();
  return snap.exists() ? { ...(snap.val() as Omit<Job, "id">), id } : null;
}

export async function listAllJobs(): Promise<Job[]> {
  const snap = await (await adminDb()).ref("jobs").get();
  return mapToArray<Job>(snap.val()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface AdminJobFilters {
  q?: string;
  departmentId?: string;
  status?: JobStatus | "";
  page?: number;
  pageSize?: number;
}

export async function queryJobs(filters: AdminJobFilters) {
  // Narrow with an indexed query when a status or department filter is supplied.
  const db = (await adminDb());
  let jobs: Job[];
  if (filters.status) {
    const status = filters.status;
    jobs = mapToArray<Job>((await withIndexFallback(() => db.ref("jobs").orderByChild("status").equalTo(status).get(), () => db.ref("jobs").get())).val());
  } else if (filters.departmentId) {
    const dept = filters.departmentId;
    jobs = mapToArray<Job>((await withIndexFallback(() => db.ref("jobs").orderByChild("departmentId").equalTo(dept).get(), () => db.ref("jobs").get())).val());
  } else {
    jobs = await listAllJobs();
  }
  const q = filters.q?.trim().toLowerCase();
  const filtered = jobs
    .filter((j) => !filters.departmentId || j.departmentId === filters.departmentId)
    .filter((j) => !filters.status || j.status === filters.status)
    .filter((j) => !q || j.title.toLowerCase().includes(q) || (j.location ?? "").toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return paginate(filtered, filters.page ?? 1, filters.pageSize ?? PAGE_SIZE.adminJobs);
}

function toPublicJob(job: Job, departmentName: string): PublicJob {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    departmentId: job.departmentId,
    departmentName,
    employmentType: job.employmentType,
    location: job.location,
    vacancies: job.vacancies,
    applicationDeadline: job.applicationDeadline,
    publishedAt: job.publishedAt ?? job.updatedAt,
    updatedAt: job.updatedAt,
  };
}

/** Writes the job and its public index entry (or removal) in one atomic multi-path update. */
async function persistJob(job: Job) {
  const { id, ...data } = job;
  let publicEntry: PublicJob | null = null;
  if (isJobPubliclyVisible(job)) {
    const dept = await getDepartment(job.departmentId);
    publicEntry = toPublicJob(job, dept?.name ?? "General");
  }
  await (await adminDb()).ref().update({ [`jobs/${id}`]: data, [`publicJobIndexes/${id}`]: publicEntry });
}

async function assertDepartmentUsable(departmentId: string, mustBeActive: boolean) {
  const dept = await getDepartment(departmentId);
  if (!dept) throw new HttpError(400, "The selected department does not exist.", "invalid_department");
  if (mustBeActive && !dept.isActive) {
    throw new HttpError(400, `The "${dept.name}" department is inactive. Activate it or choose another.`, "inactive_department");
  }
}

function buildFields(input: JobInputParsed) {
  return {
    title: input.title,
    description: sanitizeJobHtml(input.description),
    departmentId: input.departmentId,
    employmentType: input.employmentType ?? null,
    location: input.location ?? null,
    vacancies: input.vacancies ?? null,
    applicationDeadline: deadlineFromDateInput(input.applicationDeadline),
  };
}

export async function createJob(input: JobInputParsed, intent: "draft" | "publish", adminUid: string): Promise<Job> {
  await assertDepartmentUsable(input.departmentId, intent === "publish");
  const now = Date.now();
  const fields = buildFields(input);
  if (intent === "publish" && fields.applicationDeadline && fields.applicationDeadline < now) {
    throw new HttpError(400, "The application deadline is in the past.", "deadline_past");
  }
  const job: Job = {
    id: newId("jobs"),
    ...fields,
    status: intent === "publish" ? "published" : "draft",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: adminUid,
    publishedAt: intent === "publish" ? now : null,
    closedAt: null,
  };
  await persistJob(job);
  return job;
}

export async function updateJob(id: string, input: JobInputParsed, intent: "draft" | "publish" | "keep", adminUid: string) {
  const current = await getJob(id);
  if (!current) throw new HttpError(404, "Job not found.");
  const fields = buildFields(input);
  const now = Date.now();
  let status = current.status;
  if (intent === "publish") status = "published";
  if (intent === "draft") status = "draft";
  await assertDepartmentUsable(fields.departmentId, status === "published");
  if (status === "published" && fields.applicationDeadline && fields.applicationDeadline < now) {
    throw new HttpError(400, "The application deadline is in the past. Choose a future date to keep the job open.", "deadline_past");
  }
  const job: Job = {
    ...current,
    ...fields,
    status,
    updatedAt: now,
    publishedAt: status === "published" ? (current.publishedAt ?? now) : current.publishedAt,
    lastUpdatedBy: adminUid,
  };
  await persistJob(job);
  return job;
}

export async function changeJobStatus(id: string, action: "publish" | "close" | "reopen" | "unpublish") {
  const job = await getJob(id);
  if (!job) throw new HttpError(404, "Job not found.");
  const now = Date.now();
  const next: Job = { ...job, updatedAt: now };
  switch (action) {
    case "publish":
    case "reopen":
      if (job.status === "published" && job.isActive) return job;
      await assertDepartmentUsable(job.departmentId, true);
      if (isDeadlinePassed(job, now)) {
        throw new HttpError(400, "The application deadline has passed. Edit the job and set a new deadline first.", "deadline_past");
      }
      next.status = "published";
      next.isActive = true;
      next.publishedAt = job.publishedAt ?? now;
      next.closedAt = null;
      break;
    case "close":
      next.status = "closed";
      next.isActive = false;
      next.closedAt = now;
      break;
    case "unpublish":
      next.status = "draft";
      break;
  }
  await persistJob(next);
  return next;
}

/** Deletes the job posting. Applications are kept – they carry title/department snapshots. */
export async function deleteJob(id: string) {
  const job = await getJob(id);
  if (!job) throw new HttpError(404, "Job not found.");
  await (await adminDb()).ref().update({ [`jobs/${id}`]: null, [`publicJobIndexes/${id}`]: null });
}

// ── Public reads (only the public-safe index is used) ──

export async function listPublicJobs(): Promise<PublicJob[]> {
  const snap = await (await adminDb()).ref("publicJobIndexes").get();
  return mapToArray<PublicJob>(snap.val());
}

export async function getPublicJob(id: string): Promise<PublicJob | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const snap = await (await adminDb()).ref(`publicJobIndexes/${id}`).get();
  return snap.exists() ? { ...(snap.val() as Omit<PublicJob, "id">), id } : null;
}
