"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand-mark";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const links = [
  { href: siteConfig.mainWebsiteUrl, label: "Home", external: true },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className={cn("z-30 w-full", overlay ? "absolute inset-x-0 top-0" : "border-b bg-background")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/careers" aria-label={`${siteConfig.companyName} careers home`}>
          <Logo light={overlay} />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {links.map((l) => {
            const active = !l.external && pathname.startsWith(l.href);
            return (
              <Link
                key={l.label}
                href={l.href}
                {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-sm font-semibold underline-offset-8 hover:underline",
                  overlay ? "text-[#e3ece9]" : "text-foreground/80",
                  active && "underline decoration-2",
                  active && (overlay ? "text-white" : "text-canopy"),
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className={cn("rounded-md p-2 md:hidden", overlay ? "text-white" : "text-canopy")}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t bg-background px-4 py-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
              className="block rounded-md px-2 py-3 text-base font-semibold text-canopy hover:bg-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
