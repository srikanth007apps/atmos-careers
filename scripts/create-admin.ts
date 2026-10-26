/**
 * Provision an admin account (the ONLY way admins are created – there is no public sign-up).
 *
 *   npm run admin:create -- --username hr.admin --email hr@company.com --name "HR Admin" [--role super_admin]
 *
 * You'll be prompted for the password (input hidden). For CI, set ADMIN_PASSWORD instead.
 * Re-running for an existing username resets that admin's password and signs out their sessions.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import bcrypt from "bcryptjs";
import { db, fail } from "./_firebase";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function askHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, enc, cb) {
      if (!muted) process.stdout.write(chunk, enc);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const username = arg("username");
  const email = arg("email");
  const displayName = arg("name") ?? username;
  const role = arg("role") === "super_admin" ? "super_admin" : "admin";
  if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username) || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Usage: npm run admin:create -- --username hr.admin --email hr@company.com --name "HR Admin" [--role super_admin]');
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden("Password (min 10 chars, letters + a number): ");
    const confirm = await askHidden("Confirm password: ");
    if (password !== confirm) {
      console.error("✖ Passwords do not match.");
      process.exit(1);
    }
  }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.error("✖ Password must be at least 10 characters and include letters and a number.");
    process.exit(1);
  }

  const database = await db();
  const passwordHash = await bcrypt.hash(password, 12);
  const found = await database.ref("adminUsers").orderByChild("usernameLower").equalTo(username.toLowerCase()).limitToFirst(1).get();

  if (found.exists()) {
    const [uid, existing] = Object.entries(found.val() as Record<string, { sessionVersion?: number }>)[0];
    await database.ref(`adminUsers/${uid}`).update({
      passwordHash,
      email: email.toLowerCase(),
      displayName,
      role,
      isActive: true,
      sessionVersion: (existing.sessionVersion ?? 1) + 1,
      passwordChangedAt: Date.now(),
    });
    console.log(`✔ Updated admin "${username}" (uid ${uid}). Existing sessions were signed out.`);
  } else {
    const uid = database.ref("adminUsers").push().key!;
    await database.ref(`adminUsers/${uid}`).set({
      username,
      usernameLower: username.toLowerCase(),
      displayName,
      email: email.toLowerCase(),
      role,
      isActive: true,
      passwordHash,
      sessionVersion: 1,
      createdAt: Date.now(),
      lastLoginAt: null,
    });
    console.log(`✔ Created ${role} "${username}" (uid ${uid}). Sign in at /admin/login`);
  }
  process.exit(0);
}

main().catch(fail);
