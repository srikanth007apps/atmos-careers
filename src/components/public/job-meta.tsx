import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants";
import type { PublicJob } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function JobMeta({ job }: { job: PublicJob }) {
  const rows: [string, string][] = [["Department", job.departmentName]];
  if (job.employmentType) rows.push(["Job type", EMPLOYMENT_TYPE_LABELS[job.employmentType]]);
  if (job.location) rows.push(["Location", job.location]);
  if (job.vacancies) rows.push(["Openings", String(job.vacancies)]);
  rows.push(["Published", formatDate(job.publishedAt)]);
  if (job.applicationDeadline) rows.push(["Apply by", formatDate(job.applicationDeadline)]);
  return (
    <dl className="divide-y text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-semibold text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
