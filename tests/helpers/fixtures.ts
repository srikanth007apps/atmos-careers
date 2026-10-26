import { signSessionToken } from "@/lib/auth/session-token";
import { SESSION_COOKIE } from "@/lib/constants";
import type { Job } from "@/lib/types";
import { fake } from "./fake-db";

export const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
export const ORIGIN = "http://localhost:3000";

export function resetDb() {
  fake.db.data = {};
  fake.db.write("departments/dept-sales", { name: "Sales", isActive: true, createdAt: 1, updatedAt: 1 });
  fake.db.write("departments/dept-old", { name: "Old Team", isActive: false, createdAt: 1, updatedAt: 1 });
}

export function putJob(id: string, patch: Partial<Job> = {}) {
  const now = Date.now();
  const job = {
    title: "Sales Manager",
    description: "<p>Lead the sales team for our new residential launch in Bengaluru.</p>",
    departmentId: "dept-sales",
    employmentType: "full_time",
    location: "Bengaluru",
    vacancies: 2,
    applicationDeadline: null,
    status: "published",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: "admin-1",
    publishedAt: now,
    closedAt: null,
    ...patch,
  };
  fake.db.write(`jobs/${id}`, job);
  if (job.status === "published" && job.isActive) {
    fake.db.write(`publicJobIndexes/${id}`, { ...job, id, departmentName: "Sales" });
  }
  return job;
}

export function putAdmin(uid = "admin-1", patch: Record<string, unknown> = {}) {
  fake.db.write(`adminUsers/${uid}`, {
    username: "hr.admin",
    usernameLower: "hr.admin",
    displayName: "HR Admin",
    email: "hr@example.com",
    role: "admin",
    isActive: true,
    // bcrypt hash of "CorrectHorse42"
    passwordHash: "$2b$10$TKEyFGUvsR6Vz6nwMFvO8On6yLdcTPU4j0suwv7j1nZjE7tggAoB2",
    sessionVersion: 1,
    createdAt: 1,
    lastLoginAt: null,
    ...patch,
  });
}

export async function adminCookie(uid = "admin-1", ver = 1) {
  const token = await signSessionToken({ uid, role: "admin", ver });
  return `${SESSION_COOKIE}=${token}`;
}

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${url}`, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
