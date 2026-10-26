import { Suspense } from "react";
import { BanyanHero } from "@/components/public/banyan-hero";
import { JobFilters } from "@/components/public/job-filters";
import { JobRow } from "@/components/public/job-row";
import { Pagination } from "@/components/pagination";
import { siteConfig } from "@/config/site";
import { PAGE_SIZE } from "@/lib/constants";
import { filterPublicJobs } from "@/lib/job-rules";
import { listPublicJobs } from "@/lib/server/repos/jobs";
import { explainServerError } from "@/lib/server/http";
import { paginate, toInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function CareersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let loadError = false;
  let loadErrorDetail = "";
  let allOpen: Awaited<ReturnType<typeof listPublicJobs>> = [];
  try {
    allOpen = filterPublicJobs(await listPublicJobs(), {});
  } catch (err) {
    loadErrorDetail = explainServerError(err);
    console.error("[careers] failed to load jobs:", loadErrorDetail);
    loadError = true;
  }
  const filtered = filterPublicJobs(allOpen, { q: str(sp.q), department: str(sp.department), type: str(sp.type) });
  const page = paginate(filtered, toInt(sp.page), PAGE_SIZE.publicJobs);
  const departments = Array.from(new Map(allOpen.map((j) => [j.departmentId, { id: j.departmentId, name: j.departmentName }])).values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const filtering = !!(str(sp.q) || str(sp.department) || str(sp.type));

  return (
    <main id="main">
      <BanyanHero openCount={allOpen.length} />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <h2 className="text-3xl leading-tight font-normal text-canopy sm:text-4xl">Work that people come home to</h2>
        <div className="space-y-5 text-[1.05rem] leading-relaxed text-foreground/85">
          <p>
            At {siteConfig.companyName}, a project isn&apos;t finished when the slab is cast. It&apos;s finished when a family moves in and the trees
            we planted have started to give shade. Every team here, from site engineering to sales, shares that one measure of success.
          </p>
          <ul className="space-y-3 border-l-2 border-moss/40 pl-5 text-base">
            <li><strong className="text-canopy">Real ownership.</strong> Small teams, so your decisions show up in the finished homes.</li>
            <li><strong className="text-canopy">Learning on site.</strong> Architects, engineers and sales staff work across live projects in Bengaluru.</li>
            <li><strong className="text-canopy">Built to last.</strong> We design with nature, not around it, and we look for people who care about that too.</li>
          </ul>
        </div>
      </section>

      <section id="openings" className="scroll-mt-6 bg-limestone/70 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-normal text-canopy sm:text-4xl">Open positions</h2>
            {!loadError && <p className="text-sm text-muted-foreground">{filtered.length} of {allOpen.length} shown</p>}
          </div>
          {allOpen.length > 0 && (
            <div className="mb-6">
              <Suspense>
                <JobFilters departments={departments} />
              </Suspense>
            </div>
          )}

          {loadError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-card p-8 text-center">
              <p className="font-semibold text-destructive">Job openings could not be loaded.</p>
              <p className="mt-1 text-sm text-muted-foreground">Refresh the page in a moment. If it keeps happening, email {siteConfig.contact.email}.</p>
              {process.env.NODE_ENV !== "production" && loadErrorDetail && (
                <p className="mx-auto mt-4 max-w-2xl rounded-md bg-amber-50 p-3 text-left font-mono text-xs text-amber-900">
                  Developer info (hidden in production): {loadErrorDetail}
                </p>
              )}
            </div>
          ) : allOpen.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center">
              <p className="font-serif text-2xl text-canopy">No positions are open right now</p>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                New roles are posted here first. You can also send your resume to{" "}
                <a className="font-semibold text-canopy underline underline-offset-4" href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>{" "}
                and we&apos;ll keep it on file.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center">
              <p className="font-serif text-2xl text-canopy">No roles match {filtering ? "these filters" : "your search"}</p>
              <p className="mt-2 text-muted-foreground">Try a broader search or choose &ldquo;All departments&rdquo;.</p>
            </div>
          ) : (
            <>
              <ul className="bg-transparent">{page.items.map((job) => <JobRow key={job.id} job={job} />)}</ul>
              {page.totalPages > 1 && (
                <Pagination base="/careers" hash="openings" searchParams={sp} page={page.page} totalPages={page.totalPages} total={page.total} pageSize={page.pageSize} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
