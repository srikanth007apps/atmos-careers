"use client";
import { useDebouncedSearch, useUrlFilters } from "@/hooks/use-url-filters";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES } from "@/lib/constants";

export function JobFilters({ departments }: { departments: { id: string; name: string }[] }) {
  const { params, set, pending } = useUrlFilters();
  const [q, setQ] = useDebouncedSearch("q", set, params.get("q") ?? "");
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_220px_180px]" role="search">
      <div className="relative">
        <label htmlFor="job-search" className="sr-only">Search jobs</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="job-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by role, team or location" className="h-11 pl-9" />
        {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating results" />}
      </div>
      <NativeSelect aria-label="Department" value={params.get("department") ?? ""} onChange={(e) => set({ department: e.target.value })} className="[&_select]:h-11">
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="Job type" value={params.get("type") ?? ""} onChange={(e) => set({ type: e.target.value })} className="[&_select]:h-11">
        <option value="">Any job type</option>
        {EMPLOYMENT_TYPES.map((t) => (
          <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
        ))}
      </NativeSelect>
    </div>
  );
}
