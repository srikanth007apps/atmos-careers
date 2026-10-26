import "server-only";
import { DEFAULT_DEPARTMENTS } from "@/lib/constants";
import type { Department } from "@/lib/types";
import { HttpError } from "../http";
import { adminDb, mapToArray, newId, withIndexFallback } from "../firebase-admin";

export async function listDepartments(opts: { activeOnly?: boolean } = {}): Promise<Department[]> {
  const snap = await (await adminDb()).ref("departments").get();
  const all = mapToArray<Department>(snap.val()).sort((a, b) => a.name.localeCompare(b.name));
  return opts.activeOnly ? all.filter((d) => d.isActive) : all;
}

export async function getDepartment(id: string): Promise<Department | null> {
  const snap = await (await adminDb()).ref(`departments/${id}`).get();
  return snap.exists() ? { ...(snap.val() as Omit<Department, "id">), id } : null;
}

export async function departmentNameMap(): Promise<Record<string, string>> {
  const list = await listDepartments();
  return Object.fromEntries(list.map((d) => [d.id, d.name]));
}

async function assertUniqueName(name: string, exceptId?: string) {
  const existing = await listDepartments();
  if (existing.some((d) => d.id !== exceptId && d.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, `A department named "${name}" already exists.`);
  }
}

export async function createDepartment(name: string): Promise<Department> {
  await assertUniqueName(name);
  const id = newId("departments");
  const now = Date.now();
  const dept: Omit<Department, "id"> = { name, isActive: true, createdAt: now, updatedAt: now };
  await (await adminDb()).ref(`departments/${id}`).set(dept);
  return { ...dept, id };
}

export async function updateDepartment(id: string, patch: { name?: string; isActive?: boolean }): Promise<Department> {
  const current = await getDepartment(id);
  if (!current) throw new HttpError(404, "Department not found.");
  if (patch.name) await assertUniqueName(patch.name, id);

  const updates: Record<string, unknown> = { [`departments/${id}/updatedAt`]: Date.now() };
  if (patch.name !== undefined) updates[`departments/${id}/name`] = patch.name;
  if (patch.isActive !== undefined) updates[`departments/${id}/isActive`] = patch.isActive;

  // Keep the denormalised department name in the public job index in sync.
  if (patch.name && patch.name !== current.name) {
    const db = await adminDb();
    const idx = await withIndexFallback(
      () => db.ref("publicJobIndexes").orderByChild("departmentId").equalTo(id).get(),
      () => db.ref("publicJobIndexes").get(),
    );
    idx.forEach((child) => {
      if ((child.val() as { departmentId?: string })?.departmentId === id) updates[`publicJobIndexes/${child.key}/departmentName`] = patch.name;
    });
  }
  await (await adminDb()).ref().update(updates);
  return { ...current, ...patch, updatedAt: Date.now() };
}

/** Departments are never hard-deleted (jobs reference them) – deactivate instead. */
export async function seedDefaultDepartments(): Promise<{ created: string[]; skipped: string[] }> {
  const existing = await listDepartments();
  const names = new Set(existing.map((d) => d.name.toLowerCase()));
  const created: string[] = [];
  const skipped: string[] = [];
  const updates: Record<string, unknown> = {};
  const now = Date.now();
  for (const name of DEFAULT_DEPARTMENTS) {
    if (names.has(name.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    updates[`departments/${newId("departments")}`] = { name, isActive: true, createdAt: now, updatedAt: now };
    created.push(name);
  }
  if (created.length) await (await adminDb()).ref().update(updates);
  return { created, skipped };
}
