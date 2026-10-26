import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApplicationForm } from "@/components/public/application-form";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import { acceptAttribute } from "@/lib/file-validation";
import { isDeadlinePassed } from "@/lib/job-rules";
import { serverEnv } from "@/lib/server/env";
import { getPublicJob } from "@/lib/server/repos/jobs";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getPublicJob((await params).jobId).catch(() => null);
  return { title: job ? `Apply – ${job.title}` : "Apply", robots: { index: false } };
}

export default async function ApplyPage({ params }: Props) {
  const { jobId } = await params;
  const job = await getPublicJob(jobId);
  if (!job) notFound();
  const closed = isDeadlinePassed(job);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href={`/careers/jobs/${job.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-canopy">
          <ArrowLeft className="size-4" /> Back to job details
        </Link>
        <p className="mt-6 text-sm font-semibold text-moss">{job.departmentName}</p>
        <h1 className="mt-1 text-4xl font-normal text-canopy">Apply for {job.title}</h1>

        {closed ? (
          <div className="mt-8 rounded-lg border bg-card p-8">
            <p className="font-semibold">The application deadline for this role has passed.</p>
            <Button asChild className="mt-5"><Link href="/careers#openings">See other open positions</Link></Button>
          </div>
        ) : (
          <>
            <p className="mt-3 text-muted-foreground">It takes about five minutes. No account needed. Fields marked * are required.</p>
            <ApplicationForm
              jobId={job.id}
              jobTitle={job.title}
              maxBytes={serverEnv.resume.maxBytes}
              allowWord={serverEnv.resume.allowWord}
              accept={acceptAttribute(serverEnv.resume.allowWord)}
            />
          </>
        )}
      </main>
    </>
  );
}
