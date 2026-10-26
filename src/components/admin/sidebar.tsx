"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase, Building2, FilePlus2, LayoutDashboard, LogOut, Menu, PanelLeftClose, Settings, Users, X } from "lucide-react";
import { toast } from "sonner";
import { BrandMark, Logo } from "@/components/brand-mark";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { cn } from "@/lib/utils";


const nav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/jobs", label: "Manage jobs", icon: Briefcase },
  { href: "/admin/jobs/new", label: "Post a job", icon: FilePlus2 },
  { href: "/admin/applications", label: "Candidate applications", icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/jobs") return pathname === "/admin/jobs" || (pathname.startsWith("/admin/jobs/") && !pathname.startsWith("/admin/jobs/new"));
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out");
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const item = (active: boolean) =>
    cn(
      "group/item relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold text-[#c6d9d4] transition-colors hover:bg-white/8 hover:text-white",
      active && "bg-white/12 text-white shadow-[inset_3px_0_0_var(--jacaranda)]",
      collapsed && "justify-center px-0",
    );
  // Hover/focus label shown next to icons when collapsed
  const tip = cn(
    "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0f2724] px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100",
    !collapsed && "hidden",
  );
  const label = cn("truncate transition-opacity duration-200", collapsed && "sr-only");

  return (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-1">
      {nav.map(({ href, label: text, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={item(active)}>
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className={label}>{text}</span>
            <span className={tip} aria-hidden>{text}</span>
          </Link>
        );
      })}
      <button type="button" onClick={logout} disabled={loggingOut} className={cn(item(false), "mt-auto disabled:opacity-60")}>
        <LogOut className="size-[18px] shrink-0" aria-hidden />
        <span className={label}>{loggingOut ? "Signing out…" : "Logout"}</span>
        <span className={tip} aria-hidden>Logout</span>
      </button>
    </nav>
  );
}

export function AdminSidebar({ adminName, role, initialCollapsed = false }: { adminName: string; role: string; initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // Remembered in a cookie so the server renders the same width on the next page load (no flicker).
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/admin; max-age=31536000; samesite=lax`;
  }

  const initials = adminName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = role === "super_admin" ? "Super admin" : "HR admin";

  return (
    <>
      {/* Desktop: collapsible rail */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col bg-canopy-deep py-4 transition-[width] duration-300 ease-in-out lg:flex",
          collapsed ? "w-[76px] px-3" : "w-64 px-3",
        )}
      >
        <div className={cn("mb-5 flex items-center", collapsed ? "flex-col gap-3" : "h-11 justify-between pl-2")}>
          <Link href="/admin/dashboard" aria-label="Dashboard" className="min-w-0">
            {collapsed ? <BrandMark light className="h-8" /> : <Logo light label={null} className="[&_img]:h-9" />}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-[#c6d9d4] hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <Menu className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        <div className={cn("mb-4 flex items-center gap-3 rounded-md bg-white/6", collapsed ? "justify-center p-1.5" : "px-3 py-2.5")} title={collapsed ? `${adminName} (${roleLabel})` : undefined}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#9cc3b9] text-xs font-bold text-canopy-deep" aria-hidden>
            {initials}
          </span>
          <div className={cn("min-w-0", collapsed && "sr-only")}>
            <p className="truncate text-sm font-semibold text-white">{adminName}</p>
            <p className="text-xs text-[#a4bdb6]">{roleLabel}</p>
          </div>
        </div>

        <NavLinks collapsed={collapsed} />

      </aside>

      {/* Mobile: top bar + slide-in drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-canopy-deep px-4 lg:hidden">
        <Link href="/admin/dashboard"><Logo light label={null} className="[&_img]:h-7" /></Link>
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen} className="rounded-md p-2 text-white">
          <Menu className="size-5" />
        </button>
      </div>
      <div className={cn("fixed inset-0 z-40 lg:hidden", !mobileOpen && "pointer-events-none")} aria-hidden={!mobileOpen}>
        <div className={cn("absolute inset-0 bg-black/50 transition-opacity duration-300", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 flex-col bg-canopy-deep px-3 py-4 transition-transform duration-300 ease-in-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-5 flex items-center justify-between pl-2">
            <Logo light label={null} className="[&_img]:h-8" />
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-md p-2 text-white">
              <X className="size-5" />
            </button>
          </div>
          <div className="mb-4 rounded-md bg-white/6 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white">{adminName}</p>
            <p className="text-xs text-[#a4bdb6]">{roleLabel}</p>
          </div>
          {mobileOpen && <NavLinks onNavigate={() => setMobileOpen(false)} />}
        </div>
      </div>
    </>
  );
}
