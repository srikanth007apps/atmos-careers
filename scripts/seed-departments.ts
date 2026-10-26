/**
 * Seeds the standard real-estate departments (skips any that already exist).
 *   npm run seed:departments
 */
import { DEFAULT_DEPARTMENTS } from "../src/lib/constants";
import { db, fail } from "./_firebase";

async function main() {
  const database = await db();
  const snap = await database.ref("departments").get();
  const existing = new Set(Object.values((snap.val() ?? {}) as Record<string, { name: string }>).map((d) => d.name.toLowerCase()));
  const now = Date.now();
  const updates: Record<string, unknown> = {};
  for (const name of DEFAULT_DEPARTMENTS) {
    if (existing.has(name.toLowerCase())) continue;
    updates[`departments/${database.ref("departments").push().key}`] = { name, isActive: true, createdAt: now, updatedAt: now };
  }
  const count = Object.keys(updates).length;
  if (count) await database.ref().update(updates);
  console.log(`✔ ${count} department(s) added, ${DEFAULT_DEPARTMENTS.length - count} already existed.`);
  process.exit(0);
}

main().catch(fail);
