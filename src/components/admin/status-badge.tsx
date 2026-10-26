import { APPLICATION_STATUS_LABELS, JOB_STATUS_LABELS, type ApplicationStatus, type JobStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const appStyles: Record<ApplicationStatus, string> = {
  new: "bg-[#ece8f7] text-[#4f3f8c] border-[#d9d1f0]",
  under_review: "bg-amber-50 text-amber-800 border-amber-200",
  shortlisted: "bg-[#e2efeb] text-[#2c5a50] border-[#c0d9d1]",
  interview_scheduled: "bg-sky-50 text-sky-800 border-sky-200",
  selected: "bg-canopy text-white border-canopy",
  rejected: "bg-red-50 text-red-800 border-red-200",
  withdrawn: "bg-stone-100 text-stone-600 border-stone-200",
};

const jobStyles: Record<JobStatus, string> = {
  draft: "bg-stone-100 text-stone-700 border-stone-200",
  published: "bg-[#e2efeb] text-[#25524a] border-[#c0d9d1]",
  closed: "bg-red-50 text-red-800 border-red-200",
};

const dot = "size-1.5 rounded-full bg-current";

export function ApplicationStatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", appStyles[status], className)}>
      <span className={dot} aria-hidden />
      {APPLICATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function JobStatusBadge({ status, expired }: { status: JobStatus; expired?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", jobStyles[status])}>
      <span className={dot} aria-hidden />
      {JOB_STATUS_LABELS[status]}
      {expired && status === "published" ? " (deadline passed)" : ""}
    </span>
  );
}
