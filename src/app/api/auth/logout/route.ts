import { NextResponse } from "next/server";
import { clearedSessionCookie } from "@/lib/server/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedSessionCookie.name, clearedSessionCookie.value, clearedSessionCookie.options);
  return res;
}
