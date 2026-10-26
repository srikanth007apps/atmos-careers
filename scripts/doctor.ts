/**
 * Checks that the app is configured correctly and can reach Firebase and Cloudinary.
 *   npm run doctor
 */
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { v2 as cloudinary } from "cloudinary";
import { explainFirebaseError, resolveFirebaseConfig, verifyFirebaseAccess } from "../src/lib/firebase-credentials";

config({ path: ".env.local" });
config();

let problems = 0;
const ok = (m: string) => console.log(`  ✔ ${m}`);
const bad = (m: string, fix?: string) => {
  problems++;
  console.log(`  ✖ ${m}${fix ? `\n      → ${fix}` : ""}`);
};
const warn = (m: string) => console.log(`  ! ${m}`);
const timeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms))]);

async function main() {
  console.log("\nAtmos Careers – setup check\n");

  console.log("Environment");
  if (existsSync(".env.local")) ok(".env.local found");
  else bad(".env.local not found", "Copy .env.local.template to .env.local in the project folder (next to package.json).");

  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= 32 && !secret.startsWith("replace-with")) ok("SESSION_SECRET set");
  else bad("SESSION_SECRET missing or placeholder", `Run: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" and paste it into .env.local`);

  console.log("\nFirebase Realtime Database");
  let cfg: ReturnType<typeof resolveFirebaseConfig> | null = null;
  try {
    cfg = resolveFirebaseConfig();
    ok(`credentials: ${cfg.mode === "env-key" ? "service-account key in .env.local" : cfg.mode === "key-file" ? "service-account JSON file" : "Application Default Credentials (gcloud login)"}`);
    ok(`database: ${cfg.databaseURL}`);
  } catch (err) {
    bad(explainFirebaseError(err));
  }

  if (cfg) {
    try {
      await verifyFirebaseAccess(cfg.credential, cfg.databaseURL, cfg.mode);
      ok("credentials accepted by Realtime Database");
      const db = getDatabase(initializeApp({ credential: cfg.credential, databaseURL: cfg.databaseURL, projectId: cfg.projectId }));
      const [depts, jobs, pub, admins] = await timeout(
        Promise.all(["departments", "jobs", "publicJobIndexes", "adminUsers"].map((p) => db.ref(p).get())),
        20000,
        "Reading the database",
      );
      ok("connected and read data");
      const n = (s: { val(): unknown }) => Object.keys((s.val() as object) ?? {}).length;
      (n(depts) ? ok : warn)(`${n(depts)} departments${n(depts) ? "" : " – run: npm run seed:departments (or npm run seed:sample)"}`);
      ok(`${n(jobs)} jobs, ${n(pub)} published on the careers site`);
      const needed: [string, string][] = [
        ["adminUsers", "usernameLower"], ["jobs", "status"], ["jobs", "departmentId"], ["publicJobIndexes", "departmentId"],
        ["applications", "appliedAt"], ["applications", "jobId"], ["applications", "status"], ["applications", "departmentIdSnapshot"],
      ];
      const missing: string[] = [];
      for (const [path, child] of needed) {
        try {
          await timeout(db.ref(path).orderByChild(child).limitToFirst(1).get(), 15000, "Index check");
        } catch (err) {
          if (/Index not defined/i.test(String((err as Error).message))) missing.push(`${path}.${child}`);
          else throw err;
        }
      }
      if (missing.length) {
        bad(
          `database rules not published (missing indexes: ${missing.join(", ")})`,
          "Firebase console → Realtime Database → Rules → paste the contents of database.rules.json → Publish (or run: npm run rules:deploy)",
        );
      } else ok("database rules & indexes published");
      const adminList = Object.values((admins.val() ?? {}) as Record<string, { username: string; isActive: boolean; passwordHash?: string; usernameLower?: string }>);
      if (!adminList.length) bad("no admin accounts", "Run: npm run seed:sample  (admin / Atmos@2026Admin)  or  npm run admin:create -- --username ... ");
      else {
        ok(`admin accounts: ${adminList.map((a) => `${a.username}${a.isActive ? "" : " (inactive)"}`).join(", ")}`);
        for (const a of adminList) {
          if (!a.passwordHash?.startsWith("$2")) bad(`admin "${a.username}" has no valid password hash`, "Re-create it with npm run admin:create");
          if (!a.usernameLower) bad(`admin "${a.username}" is missing usernameLower – login can't find it`, "Re-create it with npm run admin:create");
        }
      }
    } catch (err) {
      bad(explainFirebaseError(err, cfg.mode));
    }
  }

  console.log("\nCloudinary (resume uploads)");
  const c = { cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET };
  if (!c.cloud_name || !c.api_key || !c.api_secret || /replace|your-cloud|^0+$/.test(`${c.cloud_name}${c.api_key}${c.api_secret}`)) {
    bad("Cloudinary keys missing or placeholders", "Cloudinary console → Settings → API Keys. Needed only for resume upload/download.");
  } else {
    try {
      cloudinary.config({ ...c, secure: true });
      await timeout(cloudinary.api.ping(), 15000, "Cloudinary ping");
      ok(`connected to cloud "${c.cloud_name}"`);
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      bad(`Cloudinary rejected the keys: ${e.error?.message ?? e.message}`, "Check cloud name (not your email), API key and API secret.");
    }
  }

  console.log(problems ? `\n${problems} problem(s) found. Fix them, then restart npm run dev.\n` : "\nAll good. Restart npm run dev if it was already running.\n");
  process.exit(problems ? 1 : 0);
}
main();
