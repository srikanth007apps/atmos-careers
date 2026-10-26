import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

function href(base: string, searchParams: SP, page: number, hash?: string) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v && k !== "page") p.set(k, v);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `${base}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

export function Pagination({
  base,
  searchParams,
  page,
  totalPages,
  total,
  pageSize,
  hash,
}: {
  base: string;
  searchParams: SP;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hash?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = "inline-flex h-9 items-center gap-1 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-accent";
  const disabled = "pointer-events-none opacity-40";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
      <p className="text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Link aria-disabled={page <= 1} className={cn(linkCls, page <= 1 && disabled)} href={href(base, searchParams, page - 1, hash)}>
          <ChevronLeft className="size-4" /> Previous
        </Link>
        <span className="px-1 text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Link aria-disabled={page >= totalPages} className={cn(linkCls, page >= totalPages && disabled)} href={href(base, searchParams, page + 1, hash)}>
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
