import "server-only";
import type { AdminRole } from "@/lib/constants";
import type { AdminUser, SafeAdmin } from "@/lib/types";
import { adminDb, newId, withIndexFallback } from "../firebase-admin";
import { safeKey } from "../hash";
import { HttpError } from "../http";
import { hashPassword } from "../password";

export function toSafeAdmin(admin: AdminUser): SafeAdmin {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = admin;
  return safe;
}

export async function getAdmin(uid: string): Promise<AdminUser | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(uid)) return null;
  const snap = await (await adminDb()).ref(`adminUsers/${uid}`).get();
  return snap.exists() ? { ...(snap.val() as Omit<AdminUser, "uid">), uid } : null;
}

export async function findAdminByUsername(username: string): Promise<AdminUser | null> {
  const wanted = username.trim().toLowerCase();
  const db = await adminDb();
  const snap = await withIndexFallback(
    () => db.ref("adminUsers").orderByChild("usernameLower").equalTo(wanted).limitToFirst(1).get(),
    () => db.ref("adminUsers").get(),
  );
  const list = Object.entries((snap.val() ?? {}) as Record<string, Omit<AdminUser, "uid">>).map(([uid, v]) => ({ ...v, uid }));
  return list.find((a) => (a.usernameLower ?? a.username?.toLowerCase()) === wanted) ?? null;
}

export async function listAdmins(): Promise<SafeAdmin[]> {
  const snap = await (await adminDb()).ref("adminUsers").get();
  return Object.entries((snap.val() ?? {}) as Record<string, Omit<AdminUser, "uid">>)
    .map(([uid, v]) => toSafeAdmin({ ...v, uid }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createAdmin(input: {
  username: string;
  password: string;
  email: string;
  displayName: string;
  role: AdminRole;
}): Promise<SafeAdmin> {
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(input.username)) {
    throw new HttpError(400, "Username must be 3–40 characters: letters, numbers, dot, dash or underscore.");
  }
  if (await findAdminByUsername(input.username)) throw new HttpError(409, "That username is already taken.");
  const uid = newId("adminUsers");
  const admin: Omit<AdminUser, "uid"> = {
    username: input.username,
    usernameLower: input.username.toLowerCase(),
    displayName: input.displayName,
    email: input.email.toLowerCase(),
    role: input.role,
    isActive: true,
    passwordHash: await hashPassword(input.password),
    sessionVersion: 1,
    createdAt: Date.now(),
    lastLoginAt: null,
  };
  await (await adminDb()).ref(`adminUsers/${uid}`).set(admin);
  return toSafeAdmin({ ...admin, uid });
}

/** Changing the password bumps sessionVersion, which signs out every other session. */
export async function setAdminPassword(uid: string, newPassword: string) {
  const admin = await getAdmin(uid);
  if (!admin) throw new HttpError(404, "Admin not found.");
  const nextVersion = (admin.sessionVersion ?? 1) + 1;
  await (await adminDb()).ref(`adminUsers/${uid}`).update({
    passwordHash: await hashPassword(newPassword),
    sessionVersion: nextVersion,
    passwordChangedAt: Date.now(),
  });
  return nextVersion;
}

export async function recordLogin(uid: string) {
  await (await adminDb()).ref(`adminUsers/${uid}/lastLoginAt`).set(Date.now());
}

// ── Brute-force protection ──
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number;
  updatedAt: number;
}

export async function getLoginLock(username: string): Promise<number> {
  const snap = await (await adminDb()).ref(`loginAttempts/${safeKey(username)}`).get();
  const rec = snap.val() as AttemptRecord | null;
  return rec && rec.lockedUntil > Date.now() ? rec.lockedUntil : 0;
}

export async function registerFailedLogin(username: string) {
  await (await adminDb())
    .ref(`loginAttempts/${safeKey(username)}`)
    .transaction((rec: AttemptRecord | null) => {
      const now = Date.now();
      const stale = !rec || now - rec.updatedAt > LOCK_MS;
      const count = (stale ? 0 : rec!.count) + 1;
      return { count, lockedUntil: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0, updatedAt: now };
    });
}

export async function clearFailedLogins(username: string) {
  await (await adminDb()).ref(`loginAttempts/${safeKey(username)}`).remove();
}

