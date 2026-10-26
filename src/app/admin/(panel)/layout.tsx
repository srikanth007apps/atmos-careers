import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/sidebar";
import { cookies } from "next/headers";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { requireAdminPage } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <div className="min-h-dvh bg-limestone/60 lg:flex">
      <AdminSidebar adminName={admin.displayName || admin.username} role={admin.role} initialCollapsed={collapsed} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
