import { describe, expect, it } from "vitest";
import {
  deadlineFromDateInput,
  deadlineToDateInput,
  filterPublicJobs,
  isJobAcceptingApplications,
  isJobPubliclyVisible,
  whyJobNotAccepting,
} from "@/lib/job-rules";
import type { PublicJob } from "@/lib/types";

const base = { status: "published" as const, isActive: true, applicationDeadline: null };

describe("job visibility and acceptance rules", () => {
  it("published + active jobs are public and accept applications", () => {
    expect(isJobPubliclyVisible(base)).toBe(true);
    expect(isJobAcceptingApplications(base)).toBe(true);
  });

  it("draft and closed jobs are not public (test #2)", () => {
    expect(isJobPubliclyVisible({ ...base, status: "draft" })).toBe(false);
    expect(isJobPubliclyVisible({ ...base, status: "closed", isActive: false })).toBe(false);
    expect(isJobPubliclyVisible(null)).toBe(false);
  });

  it("closed or expired jobs do not accept applications (test #10)", () => {
    expect(whyJobNotAccepting({ ...base, status: "closed", isActive: false })).toBe("closed");
    expect(whyJobNotAccepting({ ...base, status: "draft" })).toBe("not_published");
    expect(whyJobNotAccepting({ ...base, applicationDeadline: Date.now() - 1000 })).toBe("deadline_passed");
    expect(whyJobNotAccepting(null)).toBe("not_found");
  });

  it("deadline is the end of the chosen day in IST and round-trips", () => {
    const ms = deadlineFromDateInput("2026-11-30")!;
    expect(new Date(ms).toISOString()).toBe("2026-11-30T18:29:59.999Z");
    expect(deadlineToDateInput(ms)).toBe("2026-11-30");
    expect(isJobAcceptingApplications({ ...base, applicationDeadline: ms }, ms)).toBe(true);
    expect(isJobAcceptingApplications({ ...base, applicationDeadline: ms }, ms + 1)).toBe(false);
    expect(deadlineFromDateInput("30/11/2026")).toBeNull();
  });
});

describe("public job listing filter (test #1)", () => {
  const job = (id: string, p: Partial<PublicJob>): PublicJob => ({
    id,
    title: "Role",
    description: "",
    departmentId: "d1",
    departmentName: "Sales",
    employmentType: "full_time",
    location: "Bengaluru",
    vacancies: 1,
    applicationDeadline: null,
    publishedAt: 1,
    updatedAt: 1,
    ...p,
  });
  const jobs = [
    job("a", { title: "Site Engineer", departmentId: "eng", departmentName: "Engineering", publishedAt: 3 }),
    job("b", { title: "Sales Manager", publishedAt: 2, employmentType: "contract" }),
    job("c", { title: "Expired role", applicationDeadline: Date.now() - 1 }),
  ];

  it("hides expired jobs and sorts newest first", () => {
    expect(filterPublicJobs(jobs, {}).map((j) => j.id)).toEqual(["a", "b"]);
  });
  it("filters by search, department and job type", () => {
    expect(filterPublicJobs(jobs, { q: "engineer" }).map((j) => j.id)).toEqual(["a"]);
    expect(filterPublicJobs(jobs, { department: "eng" }).map((j) => j.id)).toEqual(["a"]);
    expect(filterPublicJobs(jobs, { type: "contract" }).map((j) => j.id)).toEqual(["b"]);
  });
});
