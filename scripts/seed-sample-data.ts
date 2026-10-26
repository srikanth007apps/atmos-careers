/**
 * Loads sample-data/atmos-sample-data.json into Realtime Database.
 * Merges each top-level node (existing unrelated data is kept; records with the same IDs are overwritten).
 *   npm run seed:sample
 */
import { readFileSync } from "node:fs";
import { db, fail } from "./_firebase";

async function main() {
  const data = JSON.parse(readFileSync("sample-data/atmos-sample-data.json", "utf8")) as Record<string, Record<string, unknown>>;
  const updates: Record<string, unknown> = {};
  for (const [root, children] of Object.entries(data)) {
    for (const [key, value] of Object.entries(children)) updates[`${root}/${key}`] = value;
  }
  await (await db()).ref().update(updates);
  console.log("✔ Sample data loaded. Admin login → username: admin  password: Atmos@2026Admin (change it in Settings).");
  process.exit(0);
}
main().catch(fail);
