import "server-only";
import { APPLICATION_STATUSES, PAGE_SIZE, type ApplicationStatus } from "@/lib/constants";
import type { Application, StatusHistoryEntry } from "@/lib/types";
import { paginate } from "@/lib/utils";
import { adminDb, increment, mapToArray, newId, withIndexFallback } from "../firebase-admin";
import { safeKey } from "../hash";
import { HttpError } from "../http";

export type ApplicationListItem = Pick<
  Application,
  | "id"
  | "jobId"
  | "jobTitleSnapshot"
  | "departmentIdSnapshot"
  | "candidateName"
  | "phone"
  | "email"
  | "status"
  | "appliedAt"
  | "resumeFileName"
>;

function toListItem(a: Application): ApplicationListItem {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitleSnapshot: a.jobTitleSnapshot,
    departmentIdSnapshot: a.departmentIdSnapshot,
    candidateName: a.candidateName,
    phone: a.phone,
    email: a.email,
    status: a.status,
    appliedAt: a.appliedAt,
    resumeFileName: a.resumeFileName,
  };
}

export function buildSearchText(a: Pick<Application, "candidateName" | "email" | "phone" | "jobTitleSnapshot">) {
  return [a.candidateName, a.email, a.phone, a.jobTitleSnapshot].join(" ").toLowerCase();
}

// ── Create ──

export type NewApplication = Omit<
  Application,
  "id" | "status" | "appliedAt" | "updatedAt" | "recruiterNotes" | "reviewedBy" | "reviewedAt" | "searchText"
>;

export type CreateResult = { id: string; application: Application; replayed: boolean };

/**
 * Saves an application atomically.
 * - `idempotencyKey` makes retries of the same submission return the original record.
 * - One application per email per job (prevents accidental duplicates).
 */
export async function createApplication(input: NewApplication, idempotencyKey: string): Promise<CreateResult> {
  const db = (await adminDb());

  const prior = await db.ref(`submissions/${idempotencyKey}`).get();
  if (prior.exists()) {
    const existing = await getApplication(String(prior.val().applicationId));
    if (existing) return { id: existing.id, application: existing, replayed: true };
  }

  const id = newId("applications");
  const dedupeRef = db.ref(`applicationKeys/${input.jobId}/${safeKey(input.email)}`);
  const reservation = await dedupeRef.transaction((current) => (current === null ? id : undefined));
  if (!reservation.committed) {
    throw new HttpError(409, "You have already applied for this position with this email address.", "duplicate_application");
  }

  const now = Date.now();
  const application: Application = {
    ...input,
    id,
    status: "new",
    appliedAt: now,
    updatedAt: now,
    recruiterNotes: "",
    reviewedBy: null,
    reviewedAt: null,
    searchText: buildSearchText(input),
  };
  const { id: _omit, ...record } = application;
  void _omit;
  const historyId = newId(`applicationStatusHistory/${id}`);
  try {
    await db.ref().update({
      [`applications/${id}`]: record,
      [`applicationStatusHistory/${id}/${historyId}`]: {
        previousStatus: null,
        newStatus: "new",
        changedAt: now,
        changedBy: "candidate",
        note: "Application submitted",
      },
      [`submissions/${idempotencyKey}`]: { applicationId: id, createdAt: now },
      "stats/applications/total": increment(1),
      "stats/applications/byStatus/new": increment(1),
      [`stats/applications/byJob/${input.jobId}`]: increment(1),
    });
  } catch (err) {
    await dedupeRef.remove().catch(() => undefined); // release the reservation so the candidate can retry
    throw err;
  }
  return { id, application, replayed: false };
}

// ── Read ──

export async function getApplication(id: string): Promise<Application | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const snap = await (await adminDb()).ref(`applications/${id}`).get();
  return snap.exists() ? { ...(snap.val() as Omit<Application, "id">), id } : null;
}

export async function getStatusHistory(id: string): Promise<StatusHistoryEntry[]> {
  const snap = await (await adminDb()).ref(`applicationStatusHistory/${id}`).get();
  return mapToArray<StatusHistoryEntry>(snap.val()).sort((a, b) => b.changedAt - a.changedAt);
}

export interface ApplicationFilters {
  q?: string;
  jobId?: string;
  departmentId?: string;
  status?: ApplicationStatus | "";
  from?: number | null;
  to?: number | null;
  page?: number;
  pageSize?: number;
}

/**
 * Server-side filtering & pagination. The most selective filter is pushed down to an indexed
 * RTDB query; remaining filters run on the server. Only one page is ever sent to the browser.
 */
export async function queryApplications(filters: ApplicationFilters) {
  const db = (await adminDb());
  const ref = db.ref("applications");
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE.applications;
  const q = filters.q?.trim().toLowerCase();
  const hasOtherFilters = !!(q || filters.jobId || filters.departmentId || filters.status || filters.from || filters.to);

  // Fast path: unfiltered list – fetch only the newest N records needed for this page.
  if (!hasOtherFilters) {
    const totalSnap = await db.ref("stats/applications/total").get();
    const total = Number(totalSnap.val() ?? 0);
    const snap = await withIndexFallback(() => ref.orderByChild("appliedAt").limitToLast(page * pageSize).get(), () => ref.get());
    const newest = mapToArray<Application>(snap.val()).sort((a, b) => b.appliedAt - a.appliedAt);
    const items = newest.slice((page - 1) * pageSize, page * pageSize).map(toListItem);
    const effectiveTotal = Math.max(total, newest.length);
    return { items, total: effectiveTotal, page, pageSize, totalPages: Math.max(1, Math.ceil(effectiveTotal / pageSize)) };
  }

  let query;
  if (filters.jobId) query = ref.orderByChild("jobId").equalTo(filters.jobId);
  else if (filters.status) query = ref.orderByChild("status").equalTo(filters.status);
  else if (filters.departmentId) query = ref.orderByChild("departmentIdSnapshot").equalTo(filters.departmentId);
  else if (filters.from || filters.to) {
    query = ref.orderByChild("appliedAt");
    if (filters.from) query = query.startAt(filters.from);
    if (filters.to) query = query.endAt(filters.to);
  } else query = ref.orderByChild("appliedAt");

  const q2 = query;
  const rows = mapToArray<Application>((await withIndexFallback(() => q2.get(), () => ref.get())).val());
  const filtered = rows
    .filter((a) => !filters.jobId || a.jobId === filters.jobId)
    .filter((a) => !filters.status || a.status === filters.status)
    .filter((a) => !filters.departmentId || a.departmentIdSnapshot === filters.departmentId)
    .filter((a) => !filters.from || a.appliedAt >= filters.from)
    .filter((a) => !filters.to || a.appliedAt <= filters.to)
    .filter((a) => !q || (a.searchText ?? buildSearchText(a)).includes(q))
    .sort((a, b) => b.appliedAt - a.appliedAt)
    .map(toListItem);
  return paginate(filtered, page, pageSize);
}

export async function recentApplications(limit = 8): Promise<ApplicationListItem[]> {
  const ref = (await adminDb()).ref("applications");
  const snap = await withIndexFallback(() => ref.orderByChild("appliedAt").limitToLast(limit).get(), () => ref.get());
  return mapToArray<Application>(snap.val())
    .sort((a, b) => b.appliedAt - a.appliedAt)
    .slice(0, limit)
    .map(toListItem);
}

// ── Update ──

export interface ApplicationUpdate {
  status?: ApplicationStatus;
  note?: string;
  recruiterNotes?: string;
}

export async function updateApplication(id: string, patch: ApplicationUpdate, admin: { uid: string; displayName: string }) {
  const db = (await adminDb());
  const current = await getApplication(id);
  if (!current) throw new HttpError(404, "Application not found.");
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`applications/${id}/updatedAt`]: now,
    [`applications/${id}/reviewedBy`]: admin.uid,
    [`applications/${id}/reviewedAt`]: now,
  };
  let previousStatus = null as ApplicationStatus | null;
  let historyId: string | null = null;

  if (patch.status && patch.status !== current.status) {
    // Claim the status change atomically so concurrent edits can't double-count stats.
    const tx = await db.ref(`applications/${id}/status`).transaction((s) => {
      if (s === null) return s;
      previousStatus = s as ApplicationStatus;
      return patch.status;
    });
    if (!tx.committed || previousStatus === null) throw new HttpError(409, "Could not update status – please refresh and try again.");
    if (previousStatus !== patch.status) {
      historyId = newId(`applicationStatusHistory/${id}`);
      updates[`applicationStatusHistory/${id}/${historyId}`] = {
        previousStatus,
        newStatus: patch.status,
        changedAt: now,
        changedBy: admin.uid,
        changedByName: admin.displayName,
        note: patch.note ?? "",
      };
      updates[`stats/applications/byStatus/${previousStatus}`] = increment(-1);
      updates[`stats/applications/byStatus/${patch.status}`] = increment(1);
    }
  }
  if (patch.recruiterNotes !== undefined) updates[`applications/${id}/recruiterNotes`] = patch.recruiterNotes;

  await db.ref().update(updates);
  const updated = (await getApplication(id))!;
  return { application: updated, previousStatus, historyId };
}

export async function setHistoryEmailStatus(applicationId: string, historyId: string, emailStatus: string) {
  await (await adminDb()).ref(`applicationStatusHistory/${applicationId}/${historyId}/emailStatus`).set(emailStatus);
}

// ── Stats ──

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  byJob: Record<string, number>;
}

export async function getApplicationStats(): Promise<ApplicationStats> {
  const snap = await (await adminDb()).ref("stats/applications").get();
  const v = (snap.val() ?? {}) as Partial<ApplicationStats>;
  const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, Math.max(0, Number(v.byStatus?.[s] ?? 0))])) as Record<
    ApplicationStatus,
    number
  >;
  return { total: Math.max(0, Number(v.total ?? 0)), byStatus, byJob: v.byJob ?? {} };
}

/** Rebuilds the counters from source data (Settings → Maintenance). */
export async function recalculateApplicationStats(): Promise<ApplicationStats> {
  const snap = await (await adminDb()).ref("applications").get();
  const rows = mapToArray<Application>(snap.val());
  const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  const byJob: Record<string, number> = {};
  for (const a of rows) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    byJob[a.jobId] = (byJob[a.jobId] ?? 0) + 1;
  }
  const stats = { total: rows.length, byStatus, byJob };
  await (await adminDb()).ref("stats/applications").set(stats);
  return stats;
}
