import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants";
import type { PublicJob } from "@/lib/types";
import { formatDate, relativeDays } from "@/lib/utils";

export function JobRow({ job }: { job: PublicJob }) {
  return (
    <li className="group grid gap-4 border-b py-6 first:border-t md:grid-cols-[1fr_auto] md:items-center md:gap-8">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-moss">{job.departmentName}</p>
        <h3 className="mt-1 text-2xl font-normal text-canopy">
          <Link href={`/careers/jobs/${job.id}`} className="underline-offset-4 hover:underline">
            {job.title}
          </Link>
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.employmentType && <span>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</span>}
          {job.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {job.location}
            </span>
          )}
          <span>
            Posted <time dateTime={new Date(job.publishedAt).toISOString()} title={formatDate(job.publishedAt)}>{relativeDays(job.publishedAt).toLowerCase()}</time>
          </span>
          {job.applicationDeadline && <span>Apply by {formatDate(job.applicationDeadline)}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href={`/careers/jobs/${job.id}`} aria-label={`View details for ${job.title}`}>View details</Link>
        </Button>
        <Button asChild>
          <Link href={`/careers/jobs/${job.id}/apply`} aria-label={`Apply for ${job.title}`}>Apply now</Link>
        </Button>
      </div>
    </li>
  );
}
