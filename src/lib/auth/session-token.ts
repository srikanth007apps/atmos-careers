/**
 * Edge-safe JWT helpers for the admin session cookie (used by middleware and route handlers).
 * The token proves who logged in; the server still re-checks the admin record on every request.
 */
import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@/lib/constants";

export interface SessionPayload {
  uid: string;
  role: AdminRole;
  /** Incremented on password change / deactivation to revoke existing sessions */
  ver: number;
}

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-with")) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAgeSeconds() {
  const hours = Number(process.env.SESSION_MAX_AGE_HOURS || 8);
  return Math.round((Number.isFinite(hours) && hours > 0 ? hours : 8) * 3600);
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.uid)
    .setIssuedAt()
    .setIssuer("atmos-careers")
    .setAudience("atmos-careers-admin")
    .setExpirationTime(`${sessionMaxAgeSeconds()}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "atmos-careers",
      audience: "atmos-careers-admin",
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.ver !== "number") return null;
    return { uid: payload.sub, role: payload.role as AdminRole, ver: payload.ver };
  } catch {
    return null;
  }
}
