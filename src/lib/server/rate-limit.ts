import "server-only";
import { adminDb } from "./firebase-admin";
import { safeKey } from "./hash";

/**
 * Fixed-window rate limiter stored in RTDB (works across serverless instances).
 * Returns true when the request is allowed.
 */
export async function rateLimit(bucket: string, identifier: string, limit: number, windowMs: number): Promise<boolean> {
  const window = Math.floor(Date.now() / windowMs);
  const ref = (await adminDb()).ref(`rateLimits/${bucket}/${safeKey(identifier)}`);
  const result = await ref.transaction((rec: { window: number; count: number } | null) => {
    if (!rec || rec.window !== window) return { window, count: 1 };
    if (rec.count >= limit) return; // abort – over the limit
    return { window, count: rec.count + 1 };
  });
  return result.committed;
}
