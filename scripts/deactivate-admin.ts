/**
 * Deactivate (or re-activate) an admin and sign them out everywhere.
 *   npx tsx scripts/deactivate-admin.ts --username hr.admin [--activate]
 */
import { db, fail } from "./_firebase";

async function main() {
  const i = process.argv.indexOf("--username");
  const username = i > -1 ? process.argv[i + 1] : undefined;
  const activate = process.argv.includes("--activate");
  if (!username) {
    console.error("Usage: npx tsx scripts/deactivate-admin.ts --username hr.admin [--activate]");
    process.exit(1);
  }
  const database = await db();
  const found = await database.ref("adminUsers").orderByChild("usernameLower").equalTo(username.toLowerCase()).limitToFirst(1).get();
  if (!found.exists()) {
    console.error(`✖ No admin named "${username}".`);
    process.exit(1);
  }
  const [uid, admin] = Object.entries(found.val() as Record<string, { sessionVersion?: number }>)[0];
  await database.ref(`adminUsers/${uid}`).update({ isActive: activate, sessionVersion: (admin.sessionVersion ?? 1) + 1 });
  console.log(`✔ ${username} is now ${activate ? "active" : "deactivated"}.`);
  process.exit(0);
}
main().catch(fail);
