import type { Job, PublicJob } from "./types";

/** IST has no daylight saving, so a fixed offset is safe for deadline maths. */
const IST_OFFSET = "+05:30";

/** Convert an HTML date input value (YYYY-MM-DD) to the last millisecond of that day in IST. */
export function deadlineFromDateInput(value: string | null | undefined): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T23:59:59.999${IST_OFFSET}`);
  return Number.isNaN(ms) ? null : ms;
}

/** Inverse of deadlineFromDateInput – for pre-filling the edit form. */
export function deadlineToDateInput(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms + 5.5 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

type JobLike = Pick<Job, "status" | "isActive" | "applicationDeadline">;

/** A job page is visible to the public only when published and active. */
export function isJobPubliclyVisible(job: JobLike | null | undefined): boolean {
  return !!job && job.status === "published" && job.isActive !== false;
}

export function isDeadlinePassed(job: Pick<Job, "applicationDeadline">, now = Date.now()): boolean {
  return job.applicationDeadline != null && now > job.applicationDeadline;
}

/** Only published, active jobs within their deadline accept applications. */
export function isJobAcceptingApplications(job: JobLike | null | undefined, now = Date.now()): boolean {
  return isJobPubliclyVisible(job) && !isDeadlinePassed(job!, now);
}

export type JobClosedReason = "not_found" | "not_published" | "closed" | "deadline_passed" | null;

export function whyJobNotAccepting(job: JobLike | null | undefined, now = Date.now()): JobClosedReason {
  if (!job) return "not_found";
  if (job.status === "closed" || job.isActive === false) return "closed";
  if (job.status !== "published") return "not_published";
  if (isDeadlinePassed(job, now)) return "deadline_passed";
  return null;
}

export interface PublicJobFilters {
  q?: string;
  department?: string;
  type?: string;
}

/** Filter the public job index – used by the server-rendered careers page. */
export function filterPublicJobs(jobs: PublicJob[], filters: PublicJobFilters, now = Date.now()): PublicJob[] {
  const q = filters.q?.trim().toLowerCase();
  return jobs
    .filter((j) => !isDeadlinePassed(j, now))
    .filter((j) => !filters.department || j.departmentId === filters.department)
    .filter((j) => !filters.type || j.employmentType === filters.type)
    .filter(
      (j) =>
        !q ||
        [j.title, j.departmentName, j.location ?? ""].some((field) => field.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

export const CLOSED_MESSAGES = {
  not_found: "This job posting no longer exists.",
  not_published: "This job is not accepting applications.",
  closed: "This position has been closed and is no longer accepting applications.",
  deadline_passed: "The application deadline for this position has passed.",
} as const;
