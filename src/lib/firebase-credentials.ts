/**
 * Works out how the server authenticates to Firebase, in this order:
 *  1. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY      (service-account key in env vars – Vercel)
 *  2. FIREBASE_SERVICE_ACCOUNT_PATH                    (path to the downloaded JSON key file)
 *  3. Application Default Credentials                  (no key file: `gcloud auth application-default login`
 *                                                       locally, or the built-in identity on Google Cloud)
 * Shared by the Next.js server and the CLI scripts. Throws FirebaseConfigError with a fix-it message.
 */
import { readFileSync } from "node:fs";
import { applicationDefault, cert, type Credential } from "firebase-admin/app";

export class FirebaseConfigError extends Error {
  readonly isConfigError = true;
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

const isPlaceholder = (v: string | undefined) =>
  !v || !v.trim() || /replace-me|REPLACE_ME|your-project|xxxxx|000000000000/i.test(v);

function normalisePrivateKey(raw: string) {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  key = key.replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----")) {
    throw new FirebaseConfigError(
      "FIREBASE_PRIVATE_KEY is not a valid private key. Copy the whole \"private_key\" value from the service-account JSON, " +
        'including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----, wrapped in double quotes on ONE line.',
    );
  }
  return key;
}

export const ADC_COMMAND =
  "gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/firebase.database,https://www.googleapis.com/auth/userinfo.email";

export type CredentialMode = "env-key" | "key-file" | "application-default";

export function resolveFirebaseConfig(): { credential: Credential; databaseURL: string; projectId: string; mode: CredentialMode } {
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (isPlaceholder(databaseURL) || !/^https:\/\/.+firebase(io\.com|database\.app)\/?$/.test(databaseURL!)) {
    throw new FirebaseConfigError(
      "FIREBASE_DATABASE_URL is missing or wrong. It should look like https://atmoscareer-3668c-default-rtdb.asia-southeast1.firebasedatabase.app",
    );
  }
  if (isPlaceholder(projectId)) throw new FirebaseConfigError("FIREBASE_PROJECT_ID is missing in .env.local.");

  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!isPlaceholder(email) && !isPlaceholder(key)) {
    return {
      credential: cert({ projectId, clientEmail: email, privateKey: normalisePrivateKey(key!) }),
      databaseURL: databaseURL!,
      projectId: projectId!,
      mode: "env-key",
    };
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path && !isPlaceholder(path)) {
    let json: { client_email?: string; private_key?: string; project_id?: string };
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      throw new FirebaseConfigError(`Could not read the service-account file at FIREBASE_SERVICE_ACCOUNT_PATH (${path}).`);
    }
    if (!json.client_email || !json.private_key) throw new FirebaseConfigError(`${path} is not a service-account key file.`);
    return {
      credential: cert({ projectId: json.project_id ?? projectId, clientEmail: json.client_email, privateKey: json.private_key }),
      databaseURL: databaseURL!,
      projectId: projectId!,
      mode: "key-file",
    };
  }

  const onGoogleCloud = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG);
  if (process.env.FIREBASE_USE_ADC !== "true" && !onGoogleCloud) {
    throw new FirebaseConfigError(
      "No Firebase server credentials configured. Either (A) paste client_email and private_key from the service-account JSON " +
        "into FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local, or (B) if your organisation blocks key creation, " +
        "set FIREBASE_USE_ADC=true and run: " + ADC_COMMAND,
    );
  }
  return { credential: applicationDefault(), databaseURL: databaseURL!, projectId: projectId!, mode: "application-default" };
}

/** Turn low-level Firebase/Google auth errors into something actionable. */
export function explainFirebaseError(err: unknown, mode?: CredentialMode): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof FirebaseConfigError) return msg;
  if (/Failed to parse private key|Invalid PEM|DECODER routines/i.test(msg)) {
    return "FIREBASE_PRIVATE_KEY could not be parsed. Paste the private_key value again exactly as in the JSON, in double quotes, keeping the \\n sequences.";
  }
  if (/Could not load the default credentials|default credentials/i.test(msg)) {
    return "No Google login found for FIREBASE_USE_ADC. Add the service-account key to .env.local, or set FIREBASE_USE_ADC=true and run: " + ADC_COMMAND + "";
  }
  if (/invalid_grant|account not found|Invalid JWT/i.test(msg)) {
    return mode === "application-default"
      ? "Your gcloud login has expired or lacks access. Run again: " + ADC_COMMAND
      : "Google rejected the service-account key (deleted or disabled, or the server clock is wrong). Generate a new key and update .env.local.";
  }
  if (/insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg)) {
    return "Your gcloud login is missing the Firebase Database scope. Run: " + ADC_COMMAND;
  }
  if (/permission[_ ]denied|Permission denied|Client doesn't have permission/i.test(msg)) {
    return "Firebase refused access. The service account or Google login needs the Firebase Admin (or Editor) role on project atmoscareer-3668c.";
  }
  if (/timed out|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) {
    return "Could not reach Firebase. Check your internet connection, VPN or proxy, and that FIREBASE_DATABASE_URL is correct.";
  }
  if (/Firebase app named .* already exists/i.test(msg)) return "Firebase was initialised twice. Restart `npm run dev`.";
  return msg;
}

/**
 * One quick authenticated REST call that proves the credentials, database URL and permissions all work.
 * (The realtime SDK silently retries forever on bad credentials, so we check up front.)
 */
export async function verifyFirebaseAccess(credential: Credential, databaseURL: string, mode: CredentialMode, timeoutMs = 15000) {
  const withTimeout = <T,>(p: Promise<T>, what: string) =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), timeoutMs))]);
  let token: string;
  try {
    token = (await withTimeout(credential.getAccessToken(), "Getting a Google access token")).access_token;
  } catch (err) {
    throw new FirebaseConfigError(explainFirebaseError(err, mode));
  }
  let res: Response;
  try {
    res = await withTimeout(fetch(`${databaseURL.replace(/\/$/, "")}/.json?shallow=true`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }), "Connecting to Realtime Database");
  } catch (err) {
    throw new FirebaseConfigError(explainFirebaseError(err, mode));
  }
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  if (res.status === 401 || res.status === 403) {
    throw new FirebaseConfigError(
      mode === "application-default"
        ? "Realtime Database refused your Google login. Make sure you signed in with an account that owns the Firebase project, and that the login includes the firebase.database scope: " + ADC_COMMAND
        : "Realtime Database refused the service account. In Google Cloud → IAM, give it the 'Firebase Realtime Database Admin' or 'Firebase Admin' role.",
    );
  }
  if (res.status === 404) throw new FirebaseConfigError(`No Realtime Database at ${databaseURL}. Copy the exact URL from Firebase console → Realtime Database → Data.`);
  if (res.status === 423) throw new FirebaseConfigError("The Realtime Database is disabled. Re-enable it in the Firebase console.");
  throw new FirebaseConfigError(`Realtime Database returned HTTP ${res.status}: ${body.slice(0, 200)}`);
}
