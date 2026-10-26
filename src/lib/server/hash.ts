import { createHash } from "node:crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** RTDB keys cannot contain . # $ [ ] / – hashing makes any value safe as a key. */
export function safeKey(value: string) {
  return sha256(value.trim().toLowerCase()).slice(0, 40);
}
