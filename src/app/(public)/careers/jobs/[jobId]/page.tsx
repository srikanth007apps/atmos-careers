import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JobMeta } from "@/components/public/job-meta";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import { isDeadlinePassed } from "@/lib/job-rules";
import { getPublicJob } from "@/lib/server/repos/jobs";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getPublicJob((await params).jobId).catch(() => null);
  return job ? { title: job.title, description: `${job.title} – ${job.departmentName}${job.location ? `, ${job.location}` : ""}` } : { title: "Job not found" };
}

export default async function JobDetailsPage({ params }: Props) {
  const { jobId } = await params;
  // Only the public index is read here: drafts and closed jobs are never in it, so they 404.
  const job = await getPublicJob(jobId);
  if (!job) notFound();
  const expired = isDeadlinePassed(job);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/careers#openings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-canopy">
          <ArrowLeft className="size-4" /> All open positions
        </Link>
        <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_320px]">
          <article>
            <p className="text-sm font-semibold text-moss">{job.departmentName}</p>
            <h1 className="mt-2 text-4xl leading-tight font-normal text-canopy sm:text-5xl">{job.title}</h1>
            {expired && (
              <p role="status" className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Applications for this role closed on the deadline. Browse other open positions or check back for new roles.
              </p>
            )}
            <div className="prose-job mt-10" dangerouslySetInnerHTML={{ __html: job.description }} />
          </article>
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-lg border bg-card p-5">
              <JobMeta job={job} />
              <div className="mt-5">
                {expired ? (
                  <Button className="w-full" size="lg" disabled>Applications closed</Button>
                ) : (
                  <Button asChild className="w-full" size="lg">
                    <Link href={`/careers/jobs/${job.id}/apply`}>Apply now</Link>
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
