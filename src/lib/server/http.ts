import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { explainFirebaseError } from "@/lib/firebase-credentials";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function zodFieldErrors(err: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function handleRouteError(err: unknown) {
  if (err instanceof HttpError) {
    return jsonError(err.status, err.message, { code: err.code, details: err.details });
  }
  if (err instanceof ZodError) {
    return jsonError(400, "Please correct the highlighted fields.", { fieldErrors: zodFieldErrors(err) });
  }
  const detail = explainServerError(err);
  console.error("[api] unexpected error:", detail, err);
  // In development show the real cause so setup problems are obvious; production stays generic.
  return jsonError(500, process.env.NODE_ENV === "production" ? "Something went wrong on our side. Please try again." : `Server error: ${detail}`);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** A human-readable cause for configuration/connection failures (Firebase, Cloudinary, session secret). */
export function explainServerError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/SESSION_SECRET/.test(msg)) {
    return "SESSION_SECRET in .env.local is missing or still the placeholder. Generate one with the command in the README and restart npm run dev.";
  }
  if (/CLOUDINARY_/.test(msg)) return msg;
  return explainFirebaseError(err);
}
