/** Shared Firebase Admin bootstrap for CLI scripts (reads .env.local). */
import { config } from "dotenv";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { explainFirebaseError, resolveFirebaseConfig, verifyFirebaseAccess } from "../src/lib/firebase-credentials";

config({ path: ".env.local" });
config();

export async function db() {
  try {
    const cfg = resolveFirebaseConfig();
    console.log(`… connecting to Firebase (${cfg.mode})`);
    await verifyFirebaseAccess(cfg.credential, cfg.databaseURL, cfg.mode);
    return getDatabase(initializeApp({ credential: cfg.credential, databaseURL: cfg.databaseURL, projectId: cfg.projectId }));
  } catch (err) {
    console.error(`\n✖ ${explainFirebaseError(err)}\n`);
    process.exit(1);
  }
}

export function fail(err: unknown): never {
  console.error(`\n✖ ${explainFirebaseError(err)}\n`);
  process.exit(1);
}
