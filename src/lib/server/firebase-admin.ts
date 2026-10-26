import "server-only";
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, ServerValue, type Database } from "firebase-admin/database";
import {
  explainFirebaseError,
  FirebaseConfigError,
  resolveFirebaseConfig,
  verifyFirebaseAccess,
  type CredentialMode,
} from "@/lib/firebase-credentials";

const APP_NAME = "atmos-careers";
const g = globalThis as unknown as { __atmosFirebase?: { app: App; mode: CredentialMode; ready?: Promise<void> } };

function state() {
  if (g.__atmosFirebase) return g.__atmosFirebase;
  let cfg;
  try {
    cfg = resolveFirebaseConfig();
  } catch (err) {
    throw new FirebaseConfigError(explainFirebaseError(err));
  }
  const app = getApps().find((a) => a.name === APP_NAME) ?? initializeApp({ credential: cfg.credential, databaseURL: cfg.databaseURL, projectId: cfg.projectId }, APP_NAME);
  g.__atmosFirebase = { app, mode: cfg.mode };
  // Check credentials once; the realtime SDK would otherwise retry silently forever on bad credentials.
  g.__atmosFirebase.ready = verifyFirebaseAccess(cfg.credential, cfg.databaseURL, cfg.mode).then(
    () => {
      if (process.env.NODE_ENV !== "production") console.info(`[firebase] connected (${cfg.mode})`);
    },
    (err) => {
      g.__atmosFirebase!.ready = undefined; // allow a retry on the next request
      delete g.__atmosFirebase; // re-read .env on retry
      throw err;
    },
  );
  return g.__atmosFirebase;
}

/** Server-only Realtime Database handle (verified). Bypasses security rules – every caller must authorise first. */
export async function adminDb(): Promise<Database> {
  const s = state();
  if (s.ready) await s.ready;
  return getDatabase(s.app);
}

export function firebaseCredentialMode() {
  return g.__atmosFirebase?.mode;
}

/** Push IDs are generated locally, so this doesn't need a network round-trip. */
export function newId(path: string): string {
  const key = getDatabase(state().app).ref(path).push().key;
  if (!key) throw new Error("Could not generate an ID");
  return key;
}

export const increment = (delta: number) => ServerValue.increment(delta);

/** Convert an RTDB object map ({id: value}) into an array with ids. */
export function mapToArray<T>(value: Record<string, Omit<T, "id">> | null | undefined): T[] {
  if (!value) return [];
  return Object.entries(value).map(([id, v]) => ({ ...(v as object), id }) as T);
}

let warnedAboutIndexes = false;
/**
 * Runs an indexed query; if the database rules (with ".indexOn") haven't been published yet,
 * falls back to reading the whole node so the app keeps working. Publish database.rules.json to fix properly.
 */
export async function withIndexFallback<T>(indexed: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await indexed();
  } catch (err) {
    if (!/Index not defined/i.test(err instanceof Error ? err.message : String(err))) throw err;
    if (!warnedAboutIndexes) {
      warnedAboutIndexes = true;
      console.warn(
        "[firebase] Database indexes are missing – publish database.rules.json (Firebase console → Realtime Database → Rules, or `npm run rules:deploy`). Falling back to slower full reads.",
      );
    }
    return fallback();
  }
}
