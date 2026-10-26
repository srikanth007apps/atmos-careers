import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, PDF_BYTES, putJob, resetDb } from "./helpers/fixtures";
import { fake } from "./helpers/fake-db";

vi.mock("@/lib/server/firebase-admin", async () => (await import("./helpers/fake-db")).firebaseAdminMock());

const cloud = vi.hoisted(() => ({ bytes: new Uint8Array(), size: 1000, missing: false, deleted: [] as string[] }));
vi.mock("@/lib/server/cloudinary", () => ({
  createResumeUploadSignature: (jobId: string, kind: string) => ({
    uploadUrl: "https://api.cloudinary.com/v1_1/demo-cloud/raw/upload",
    publicId: `atmos-careers/resumes/${jobId}/abc.${kind}`,
    fields: { signature: "sig" },
  }),
  isOurResumePublicId: (pid: string, jobId: string) => pid.startsWith(`atmos-careers/resumes/${jobId}/`),
  getResumeResource: async (pid: string) =>
    cloud.missing ? null : { publicId: pid, bytes: cloud.size, url: `https://res.cloudinary.com/demo-cloud/raw/authenticated/v1/${pid}`, version: 1 },
  fetchResumeBytes: async () => cloud.bytes,
  deleteResume: async (pid: string) => {
    cloud.deleted.push(pid);
  },
  createResumeDownloadUrl: (pid: string) => `https://api.cloudinary.com/v1_1/demo-cloud/raw/download?public_id=${pid}&expires_at=1`,
}));

const { POST: submit } = await import("@/app/api/applications/route");
const { POST: sign } = await import("@/app/api/uploads/resume-signature/route");
const { getPublicJob, listPublicJobs } = await import("@/lib/server/repos/jobs");

const body = (jobId = "job-open", patch: Record<string, unknown> = {}) => ({
  candidateName: "Ananya Rao",
  phone: "9876543210",
  email: "ananya@example.com",
  message: "I have five years of experience selling residential projects.",
  consent: true,
  jobId,
  idempotencyKey: crypto.randomUUID(),
  resume: { publicId: `atmos-careers/resumes/${jobId}/abc.pdf`, originalFileName: "Ananya CV.pdf" },
  ...patch,
});

beforeEach(() => {
  resetDb();
  cloud.bytes = PDF_BYTES;
  cloud.size = 1000;
  cloud.missing = false;
  cloud.deleted = [];
  putJob("job-open");
  putJob("job-draft", { status: "draft", publishedAt: null });
  putJob("job-closed", { status: "closed", isActive: false });
  putJob("job-expired", { applicationDeadline: Date.now() - 60_000 });
});

describe("public job reads", () => {
  it("1. public users can view published jobs", async () => {
    expect((await listPublicJobs()).map((j) => j.id).sort()).toEqual(["job-expired", "job-open"]);
    expect(await getPublicJob("job-open")).toMatchObject({ title: "Sales Manager", departmentName: "Sales" });
  });

  it("2. public users cannot access draft or closed jobs", async () => {
    expect(await getPublicJob("job-draft")).toBeNull();
    expect(await getPublicJob("job-closed")).toBeNull();
    expect(await getPublicJob("../adminUsers")).toBeNull();
  });
});

describe("POST /api/applications", () => {
  it("3. accepts a valid application and stores it with job snapshot, timestamp and stats", async () => {
    const res = await submit(jsonRequest("/api/applications", "POST", body()));
    expect(res.status).toBe(201);
    const { applicationId } = await res.json();
    const saved = fake.db.read(`applications/${applicationId}`) as Record<string, unknown>;
    expect(saved).toMatchObject({
      jobId: "job-open",
      jobTitleSnapshot: "Sales Manager",
      departmentIdSnapshot: "dept-sales",
      status: "new",
      resumePath: "atmos-careers/resumes/job-open/abc.pdf",
      resumeFileName: "Ananya CV.pdf",
      resumeContentType: "application/pdf",
    });
    expect(saved.resumeUrl).toContain("/raw/authenticated/");
    expect(typeof saved.appliedAt).toBe("number");
    expect(fake.db.read("stats/applications")).toMatchObject({ total: 1, byStatus: { new: 1 }, byJob: { "job-open": 1 } });
    expect(Object.keys(fake.db.read(`applicationStatusHistory/${applicationId}`) as object)).toHaveLength(1);
  });

  it("4. rejects invalid fields with field errors and saves nothing", async () => {
    const res = await submit(jsonRequest("/api/applications", "POST", body("job-open", { email: "nope", consent: false })));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.fieldErrors).toHaveProperty("email");
    expect(data.fieldErrors).toHaveProperty("consent");
    expect(fake.db.read("applications")).toBeNull();
  });

  it("4b. rejects a resume whose content is not a real PDF and deletes the upload", async () => {
    cloud.bytes = new TextEncoder().encode("<html>fake</html>");
    const res = await submit(jsonRequest("/api/applications", "POST", body()));
    expect(res.status).toBe(400);
    expect(cloud.deleted).toEqual(["atmos-careers/resumes/job-open/abc.pdf"]);
    expect(fake.db.read("applications")).toBeNull();
  });

  it("4c. rejects oversized resumes and resumes from another job's folder", async () => {
    cloud.size = 6 * 1024 * 1024;
    expect((await submit(jsonRequest("/api/applications", "POST", body()))).status).toBe(400);
    cloud.size = 1000;
    const foreign = body("job-open", { resume: { publicId: "atmos-careers/resumes/other-job/x.pdf", originalFileName: "cv.pdf" } });
    expect((await submit(jsonRequest("/api/applications", "POST", foreign))).status).toBe(400);
  });

  it("10. closed, draft and expired jobs reject applications", async () => {
    for (const id of ["job-closed", "job-draft", "job-expired"]) {
      const res = await submit(jsonRequest("/api/applications", "POST", body(id)));
      expect(res.status).toBe(410);
    }
    expect((await submit(jsonRequest("/api/applications", "POST", body("missing-job")))).status).toBe(404);
    expect(fake.db.read("applications")).toBeNull();
  });

  it("prevents duplicate applications but replays the same submission idempotently", async () => {
    const first = body();
    const a = await submit(jsonRequest("/api/applications", "POST", first));
    const replay = await submit(jsonRequest("/api/applications", "POST", first));
    expect(replay.status).toBe(200);
    expect((await replay.json()).applicationId).toBe((await a.json()).applicationId);

    const dup = await submit(jsonRequest("/api/applications", "POST", body()));
    expect(dup.status).toBe(409);
    expect(Object.keys(fake.db.read("applications") as object)).toHaveLength(1);
  });
});

describe("POST /api/uploads/resume-signature", () => {
  const req = (p: Record<string, unknown>) =>
    jsonRequest("/api/uploads/resume-signature", "POST", { jobId: "job-open", fileName: "cv.pdf", fileSize: 1000, fileType: "application/pdf", ...p });

  it("signs uploads for open jobs only", async () => {
    const ok = await sign(req({}));
    expect(ok.status).toBe(200);
    expect((await ok.json()).publicId).toMatch(/^atmos-careers\/resumes\/job-open\//);
    expect((await sign(req({ jobId: "job-closed" }))).status).toBe(410);
  });

  it("rejects unsupported formats and oversized files before upload", async () => {
    expect((await sign(req({ fileName: "cv.exe", fileType: "application/x-msdownload" }))).status).toBe(400);
    expect((await sign(req({ fileSize: 50 * 1024 * 1024 }))).status).toBe(400);
  });
});

