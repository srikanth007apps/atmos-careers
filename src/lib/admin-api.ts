"use client";
import { toast } from "sonner";

export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

/** Fetch wrapper for admin API calls: JSON in/out, friendly errors, session-expiry redirect. */
export async function adminApi<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Network error – check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    toast.error("Your session has expired", { description: "Please sign in again." });
    window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new ApiError("Session expired", 401);
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fieldErrors ?? data.details?.fieldErrors);
  }
  return data as T;
}
