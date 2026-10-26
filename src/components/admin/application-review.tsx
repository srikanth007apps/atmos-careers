"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/lib/admin-api";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/constants";

export function StatusUpdater({ applicationId, current, emailAvailable }: { applicationId: string; current: ApplicationStatus; emailAvailable: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(current);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const changed = status !== current;

  async function save() {
    setSaving(true);
    try {
      const res = await adminApi<{ email: "sent" | "failed" | "skipped" }>(`/api/admin/applications/${applicationId}`, "PATCH", {
        status,
        note,
        notifyCandidate: emailAvailable && notify,
      });
      toast.success(`Status changed to ${APPLICATION_STATUS_LABELS[status]}`);
      if (emailAvailable && notify) {
        if (res.email === "sent") toast.success("Candidate notified by email");
        else if (res.email === "failed") toast.warning("Status saved, but the email could not be sent");
        else toast.info("Status saved. No email was sent for this status.");
      }
      setNote("");
      setNotify(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field id="status" label="Application status">
        <NativeSelect id="status" value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}
        </NativeSelect>
      </Field>
      {changed && (
        <>
          <Field id="status-note" label="Reason or note (optional)" hint="Saved in the status history. Not shared with the candidate.">
            <Textarea id="status-note" rows={2} className="min-h-0" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {emailAvailable && status !== "new" && (
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
              Email the candidate about this update
            </label>
          )}
        </>
      )}
      <Button onClick={save} disabled={!changed || saving} className="w-full">
        {saving && <Loader2 className="animate-spin" />}
        Update status
      </Button>
    </div>
  );
}

export function RecruiterNotes({ applicationId, initial }: { applicationId: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await adminApi(`/api/admin/applications/${applicationId}`, "PATCH", { recruiterNotes: value });
      toast.success("Notes saved");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3">
      <label htmlFor="notes" className="sr-only">Internal recruiter notes</label>
      <Textarea id="notes" rows={6} value={value} maxLength={10000} onChange={(e) => setValue(e.target.value)} placeholder="Interview feedback, salary expectations, notice period…" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Only visible to HR admins.</p>
        <Button variant="outline" onClick={save} disabled={saving || value === initial}>
          {saving && <Loader2 className="animate-spin" />}
          Save notes
        </Button>
      </div>
    </div>
  );
}
