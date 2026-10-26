"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi } from "@/lib/admin-api";

interface Row {
  id: string;
  name: string;
  isActive: boolean;
  jobCount: number;
  openJobs: number;
}

export function DepartmentsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setAddError("Enter a department name");
    setAdding(true);
    setAddError(undefined);
    try {
      await adminApi("/api/admin/departments", "POST", { name: name.trim() });
      toast.success(`${name.trim()} added`);
      setName("");
      router.refresh();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: { name?: string; isActive?: boolean }, done: string) {
    setBusyId(id);
    try {
      await adminApi(`/api/admin/departments/${id}`, "PATCH", body);
      toast.success(done);
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function seed() {
    setBusyId("seed");
    try {
      const res = await adminApi<{ created: string[] }>("/api/admin/maintenance", "POST", { task: "seed-departments" });
      toast.success(`${res.created.length} departments added`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap items-start gap-2 rounded-lg border bg-card p-4" noValidate>
        <div className="min-w-[240px] flex-1">
          <label htmlFor="new-dept" className="sr-only">New department name</label>
          <Input id="new-dept" value={name} onChange={(e) => setName(e.target.value)} placeholder="New department name" maxLength={80} aria-invalid={!!addError} aria-describedby={addError ? "new-dept-error" : undefined} />
          {addError && <p id="new-dept-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">{addError}</p>}
        </div>
        <Button type="submit" disabled={adding}>{adding ? <Loader2 className="animate-spin" /> : <Plus />} Add department</Button>
      </form>

      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold">No departments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your own, or start with the standard set for a real estate company (Sales, Presales, CRM, Construction and more).</p>
            <Button className="mt-5" onClick={seed} disabled={busyId === "seed"}>
              {busyId === "seed" ? <Loader2 className="animate-spin" /> : <Sprout />} Add standard departments
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} className={d.isActive ? "" : "text-muted-foreground"}>
                  <TableCell className="font-semibold">{d.name}</TableCell>
                  <TableCell>
                    {d.jobCount > 0 ? (
                      <Link href={`/admin/jobs?department=${d.id}`} className="hover:underline">
                        {d.jobCount} {d.jobCount === 1 ? "job" : "jobs"}{d.openJobs > 0 ? `, ${d.openJobs} published` : ""}
                      </Link>
                    ) : (
                      "No jobs"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={d.isActive}
                        disabled={busyId === d.id}
                        aria-label={`${d.isActive ? "Deactivate" : "Activate"} ${d.name}`}
                        onCheckedChange={(v) => patch(d.id, { isActive: v }, v ? `${d.name} activated` : `${d.name} deactivated`)}
                      />
                      <span className="text-xs">{d.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(d); setEditName(d.name); }}>
                      <Pencil /> Rename
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Departments can&apos;t be deleted because jobs and applications refer to them. Deactivate one to hide it from the job form; existing jobs keep working.
      </p>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename department</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing && editName.trim().length >= 2) patch(editing.id, { name: editName.trim() }, "Department renamed");
            }}
            className="space-y-4"
          >
            <label htmlFor="rename" className="sr-only">Department name</label>
            <Input id="rename" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={busyId === editing?.id || editName.trim().length < 2}>
                {busyId === editing?.id && <Loader2 className="animate-spin" />}Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
