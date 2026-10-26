"use client";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useDebouncedSearch, useUrlFilters } from "@/hooks/use-url-filters";

export interface SelectFilter {
  key: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}

export function AdminFilters({
  searchPlaceholder,
  selects,
  dateRange = false,
}: {
  searchPlaceholder: string;
  selects: SelectFilter[];
  dateRange?: boolean;
}) {
  const { params, set, pending } = useUrlFilters();
  const [q, setQ] = useDebouncedSearch("q", set, params.get("q") ?? "");
  const active = [...params.keys()].some((k) => k !== "page");

  return (
    <div className="mb-4 rounded-lg border bg-card p-3" role="search">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-[2]">
          <label htmlFor="admin-search" className="sr-only">Search</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-9" />
          {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating" />}
        </div>
        {selects.map((s) => (
          <NativeSelect key={s.key} aria-label={s.label} className="min-w-[160px] flex-1" value={params.get(s.key) ?? ""} onChange={(e) => set({ [s.key]: e.target.value })}>
            <option value="">{s.allLabel}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
        ))}
        {dateRange && (
          <div className="flex flex-1 items-center gap-2">
            <Input type="date" aria-label="Applied from" className="min-w-[140px]" value={params.get("from") ?? ""} max={params.get("to") ?? undefined} onChange={(e) => set({ from: e.target.value })} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" aria-label="Applied to" className="min-w-[140px]" value={params.get("to") ?? ""} min={params.get("from") ?? undefined} onChange={(e) => set({ to: e.target.value })} />
          </div>
        )}
        {active && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQ("");
              set(Object.fromEntries([...params.keys()].map((k) => [k, ""])));
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
