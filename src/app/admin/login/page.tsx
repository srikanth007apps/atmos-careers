import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand-mark";
import { LoginForm } from "@/components/admin/login-form";
import { SESSION_COOKIE } from "@/lib/constants";
import { adminFromToken } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

function safeNext(next: string | undefined) {
  return next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const admin = await adminFromToken(token).catch(() => null);
    if (admin) redirect(next);
  }
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-canopy p-12 text-[#eef4f2] lg:flex lg:flex-col lg:justify-between">
        <Logo light label="HR admin" />
        <div>
          <p className="font-serif text-4xl leading-tight">Hiring desk</p>
          <p className="mt-3 max-w-sm text-[#b3cbc5]">Post openings, review applicants and move candidates forward, all in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <Logo label={null} className="mb-8 lg:hidden" />
          <h1 className="text-3xl font-normal text-canopy">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">For authorised HR staff only. Contact your administrator if you need an account.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
