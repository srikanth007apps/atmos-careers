import bcrypt from "bcryptjs";

const ROUNDS = 12;
let dummyHash: Promise<string> | undefined;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Run a comparison even when the username is unknown, so response timing doesn't reveal valid usernames. */
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= bcrypt.hash("timing-equaliser", ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
