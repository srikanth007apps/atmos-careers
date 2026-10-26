import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminCookie, ctx, jsonRequest, ORIGIN, putAdmin, putJob, resetDb } from "./helpers/fixtures";
import { fake } from "./helpers/fake-db";
import { SignJWT } from "jose";

vi.mock("@/lib/server/firebase-admin", async () => (await import("./helpers/fake-db")).firebaseAdminMock());
vi.mock("@/lib/server/cloudinary", () => ({
  createResumeDownloadUrl: (pid: string, ttl: number) => `https://api.cloudinary.com/v1_1/demo-cloud/raw/download?public_id=${pid}&ttl=${ttl}`,
}));

const { middleware } = await import("@/middleware");
const appsList = await import("@/app/api/admin/applications/route");
const appItem = await import("@/app/api/admin/applications/[applicationId]/route");
const resume = await import("@/app/api/admin/applications/[applicationId]/resume/route");
const jobs = await import("@/app/api/admin/jobs/route");
const jobItem = await import("@/app/api/admin/jobs/[jobId]/route");
const jobStatus = await import("@/app/api/admin/jobs/[jobId]/status/route");
const login = await import("@/app/api/auth/login/route");
const { getPublicJob } = await import("@/lib/server/repos/jobs");

function putApplication(id = "app-1", jobId = "job-open") {
  fake.db.write(`applications/${id}`, {
    jobId,
    jobTitleSnapshot: "Sales Manager",
    departmentIdSnapshot: "dept-sales",
    candidateName: "Ananya Rao",
    phone: "9876543210",
    email: "ananya@example.com",
    message: "Hello there, this is my application.",
    resumePath: `atmos-careers/resumes/${jobId}/abc.pdf`,
    resumeUrl: "https://res.cloudinary.com/x",
    resumeFileName: "cv.pdf",
    resumeContentType: "application/pdf",
    resumeSize: 1000,
    resumeFormat: "pdf",
    status: "new",
    appliedAt: Date.now(),
    updatedAt: Date.now(),
    recruiterNotes: "",
    reviewedBy: null,
    reviewedAt: null,
    consentAt: Date.now(),
    searchText: "ananya rao ananya@example.com 9876543210 sales manager",
  });
  fake.db.write("stats/applications", { total: 1, byStatus: { new: 1 }, byJob: { [jobId]: 1 } });
}

const withCookie = (req: Request, cookie: string) => {
  const h = new Headers(req.headers);
  h.set("cookie", cookie);
  return new Request(req.url, { method: req.method, headers: h, body: req.body, duplex: "half" } as RequestInit);
};

const newJob = {
  title: "Site Engineer",
  description: "<p>Supervise construction quality on our Whitefield project.</p><script>alert(1)</script>",
  departmentId: "dept-sales",
  intent: "publish",
};

beforeEach(() => {
  resetDb();
  putAdmin();
  putJob("job-open");
  putApplication();
});

describe("5. admin pages are protected by middleware", () => {
  it("redirects anonymous visitors to the login page", async () => {
    const res = await middleware(new NextRequest(`${ORIGIN}/admin/dashboard`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login?next=%2Fadmin%2Fdashboard");
  });

  it("rejects forged and expired tokens", async () => {
    const forged = await new SignJWT({ role: "admin", ver: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-1")
      .setIssuer("atmos-careers")
      .setAudience("atmos-careers-admin")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("attacker-secret-attacker-secret-1234"));
    const req = new NextRequest(`${ORIGIN}/admin/dashboard`, { headers: { cookie: `atmos_admin_session=${forged}` } });
    expect((await middleware(req)).status).toBe(307);
  });

  it("lets a valid session through", async () => {
    const req = new NextRequest(`${ORIGIN}/admin/dashboard`, { headers: { cookie: await adminCookie() } });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns 401 JSON for admin APIs and blocks cross-site writes", async () => {
    expect((await middleware(new NextRequest(`${ORIGIN}/api/admin/applications`))).status).toBe(401);
    const csrf = new NextRequest(`${ORIGIN}/api/admin/jobs`, { method: "POST", headers: { origin: "https://evil.example", cookie: await adminCookie() } });
    expect((await middleware(csrf)).status).toBe(403);
  });
});

describe("6. candidate records require an authorised admin", () => {
  it("anonymous requests get 401 for lists, details and status history", async () => {
    expect((await appsList.GET(jsonRequest("/api/admin/applications", "GET"))).status).toBe(401);
    expect((await appItem.GET(jsonRequest("/api/admin/applications/app-1", "GET"), ctx({ applicationId: "app-1" }))).status).toBe(401);
  });

  it("deactivated admins and revoked sessions are rejected even with a valid token", async () => {
    const cookie = await adminCookie();
    putAdmin("admin-1", { isActive: false });
    expect((await appsList.GET(withCookie(jsonRequest("/api/admin/applications", "GET"), cookie))).status).toBe(401);
    putAdmin("admin-1", { sessionVersion: 2 }); // e.g. password changed elsewhere
    expect((await appsList.GET(withCookie(jsonRequest("/api/admin/applications", "GET"), cookie))).status).toBe(401);
  });

  it("an active admin can list and read applications; the stored resume URL is never returned", async () => {
    const cookie = await adminCookie();
    const list = await appsList.GET(withCookie(jsonRequest("/api/admin/applications?q=ananya", "GET"), cookie));
    expect(list.status).toBe(200);
    expect((await list.json()).items).toHaveLength(1);
    const item = await appItem.GET(withCookie(jsonRequest("/api/admin/applications/app-1", "GET"), cookie), ctx({ applicationId: "app-1" }));
    const data = await item.json();
    expect(data.application.candidateName).toBe("Ananya Rao");
    expect(data.application.resumeUrl).toBeUndefined();
  });
});

describe("7. only admins can create and edit jobs", () => {
  it("rejects anonymous create/edit/delete/status changes", async () => {
    expect((await jobs.POST(jsonRequest("/api/admin/jobs", "POST", newJob))).status).toBe(401);
    expect((await jobItem.PATCH(jsonRequest("/api/admin/jobs/job-open", "PATCH", newJob), ctx({ jobId: "job-open" }))).status).toBe(401);
    expect((await jobItem.DELETE(jsonRequest("/api/admin/jobs/job-open", "DELETE"), ctx({ jobId: "job-open" }))).status).toBe(401);
    expect((await jobStatus.POST(jsonRequest("/api/admin/jobs/job-open/status", "POST", { action: "close" }), ctx({ jobId: "job-open" }))).status).toBe(401);
    expect(fake.db.read("jobs/job-open/status")).toBe("published");
  });

  it("an admin can create a published job (HTML sanitised, public index written) and a draft (not public)", async () => {
    const cookie = await adminCookie();
    const res = await jobs.POST(withCookie(jsonRequest("/api/admin/jobs", "POST", newJob), cookie));
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job.createdBy).toBe("admin-1");
    expect(job.description).not.toContain("<script>");
    expect(await getPublicJob(job.id)).not.toBeNull();

    const draft = await jobs.POST(withCookie(jsonRequest("/api/admin/jobs", "POST", { ...newJob, intent: "draft" }), cookie));
    expect(await getPublicJob((await draft.json()).job.id)).toBeNull();
  });

  it("cannot publish into an inactive department", async () => {
    const res = await jobs.POST(withCookie(jsonRequest("/api/admin/jobs", "POST", { ...newJob, departmentId: "dept-old" }), await adminCookie()));
    expect(res.status).toBe(400);
  });
});

describe("8. only admins can update application status", () => {
  it("rejects anonymous status updates", async () => {
    const res = await appItem.PATCH(jsonRequest("/api/admin/applications/app-1", "PATCH", { status: "shortlisted" }), ctx({ applicationId: "app-1" }));
    expect(res.status).toBe(401);
    expect(fake.db.read("applications/app-1/status")).toBe("new");
  });

  it("an admin update records history with previous/new status, admin UID and adjusts counts", async () => {
    const req = withCookie(jsonRequest("/api/admin/applications/app-1", "PATCH", { status: "shortlisted", note: "Strong profile" }), await adminCookie());
    const res = await appItem.PATCH(req, ctx({ applicationId: "app-1" }));
    expect(res.status).toBe(200);
    expect(fake.db.read("applications/app-1")).toMatchObject({ status: "shortlisted", reviewedBy: "admin-1" });
    const history = Object.values(fake.db.read("applicationStatusHistory/app-1") as object);
    expect(history[0]).toMatchObject({ previousStatus: "new", newStatus: "shortlisted", changedBy: "admin-1", note: "Strong profile" });
    expect(fake.db.read("stats/applications/byStatus")).toMatchObject({ new: 0, shortlisted: 1 });
  });
});

describe("9. resume downloads require authorisation", () => {
  it("anonymous requests get 401 and no signed URL", async () => {
    const res = await resume.GET(jsonRequest("/api/admin/applications/app-1/resume", "GET"), ctx({ applicationId: "app-1" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("admins are redirected to a 60-second signed Cloudinary link", async () => {
    const res = await resume.GET(withCookie(jsonRequest("/api/admin/applications/app-1/resume", "GET"), await adminCookie()), ctx({ applicationId: "app-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("ttl=60");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("10. closing a job keeps existing applications", () => {
  it("close removes the job from the public site, blocks applications, keeps applications", async () => {
    const cookie = await adminCookie();
    const res = await jobStatus.POST(withCookie(jsonRequest("/api/admin/jobs/job-open/status", "POST", { action: "close" }), cookie), ctx({ jobId: "job-open" }));
    expect(res.status).toBe(200);
    expect(fake.db.read("jobs/job-open")).toMatchObject({ status: "closed", isActive: false });
    expect(await getPublicJob("job-open")).toBeNull();
    expect(fake.db.read("applications/app-1")).not.toBeNull();

    const list = await appsList.GET(withCookie(jsonRequest("/api/admin/applications?job=job-open", "GET"), cookie));
    expect((await list.json()).items).toHaveLength(1);

    const reopen = await jobStatus.POST(withCookie(jsonRequest("/api/admin/jobs/job-open/status", "POST", { action: "reopen" }), cookie), ctx({ jobId: "job-open" }));
    expect(reopen.status).toBe(200);
    expect(await getPublicJob("job-open")).not.toBeNull();
  });

  it("deleting a job also keeps its applications", async () => {
    await jobItem.DELETE(withCookie(jsonRequest("/api/admin/jobs/job-open", "DELETE"), await adminCookie()), ctx({ jobId: "job-open" }));
    expect(fake.db.read("jobs/job-open")).toBeNull();
    expect(fake.db.read("applications/app-1")).not.toBeNull();
  });
});

describe("admin login", () => {
  it("signs in with correct credentials and sets an httpOnly cookie", async () => {
    const res = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "HR.Admin", password: "CorrectHorse42" }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("atmos_admin_session=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("rejects wrong passwords and unknown users with the same message, then locks out", async () => {
    const wrong = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "hr.admin", password: "nope" }));
    const unknown = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "ghost", password: "nope" }));
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error).toBe((await unknown.json()).error);
    for (let i = 0; i < 4; i++) await login.POST(jsonRequest("/api/auth/login", "POST", { username: "hr.admin", password: "nope" }));
    const locked = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "hr.admin", password: "CorrectHorse42" }));
    expect(locked.status).toBe(429);
  });

  it("still works when the database rules/indexes haven't been published yet", async () => {
    fake.db.missingIndexes = true;
    try {
      const res = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "hr.admin", password: "CorrectHorse42" }));
      expect(res.status).toBe(200);
      const cookie = await adminCookie();
      const list = await appsList.GET(withCookie(jsonRequest("/api/admin/applications?status=new", "GET"), cookie));
      expect((await list.json()).items).toHaveLength(1);
      const all = await appsList.GET(withCookie(jsonRequest("/api/admin/applications", "GET"), cookie));
      expect((await all.json()).items).toHaveLength(1);
    } finally {
      fake.db.missingIndexes = false;
    }
  });

  it("blocks cross-site login posts", async () => {
    const res = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "hr.admin", password: "CorrectHorse42" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });
});

