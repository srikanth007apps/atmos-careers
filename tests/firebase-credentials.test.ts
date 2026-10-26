import { afterEach, describe, expect, it } from "vitest";
import { explainFirebaseError, FirebaseConfigError, resolveFirebaseConfig } from "@/lib/firebase-credentials";

const saved = { ...process.env };
const base = {
  FIREBASE_PROJECT_ID: "atmoscareer-3668c",
  FIREBASE_DATABASE_URL: "https://atmoscareer-3668c-default-rtdb.asia-southeast1.firebasedatabase.app",
};
function env(vars: Record<string, string | undefined>) {
  for (const k of ["FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_USE_ADC", "FIREBASE_SERVICE_ACCOUNT_PATH", "K_SERVICE", "FIREBASE_CONFIG"]) delete process.env[k];
  Object.assign(process.env, base, vars);
}
afterEach(() => {
  process.env = { ...saved };
});

describe("Firebase credential resolution", () => {
  it("explains what to do when nothing is configured (template placeholders)", () => {
    env({ FIREBASE_CLIENT_EMAIL: "firebase-adminsdk-xxxxx@x.iam.gserviceaccount.com", FIREBASE_PRIVATE_KEY: '"-----BEGIN PRIVATE KEY-----\\nREPLACE_ME\\n-----END PRIVATE KEY-----\\n"' });
    expect(() => resolveFirebaseConfig()).toThrow(/No Firebase server credentials configured.*FIREBASE_USE_ADC=true/s);
  });

  it("uses Application Default Credentials only when explicitly enabled", () => {
    env({ FIREBASE_USE_ADC: "true" });
    expect(resolveFirebaseConfig().mode).toBe("application-default");
  });

  it("rejects a truncated private key with a clear message", () => {
    env({ FIREBASE_CLIENT_EMAIL: "svc@atmoscareer-3668c.iam.gserviceaccount.com", FIREBASE_PRIVATE_KEY: "MIIEvQIBADAN" });
    expect(() => resolveFirebaseConfig()).toThrow(FirebaseConfigError);
  });

  it("rejects a wrong database URL", () => {
    env({ FIREBASE_USE_ADC: "true", FIREBASE_DATABASE_URL: "https://console.firebase.google.com/project/x" });
    expect(() => resolveFirebaseConfig()).toThrow(/FIREBASE_DATABASE_URL/);
  });

  it("translates common Google errors", () => {
    expect(explainFirebaseError(new Error("Failed to parse private key: Error: Invalid PEM formatted message."))).toMatch(/could not be parsed/);
    expect(explainFirebaseError(new Error("invalid_grant: Invalid JWT Signature."), "env-key")).toMatch(/rejected the service-account key/);
  });
});
