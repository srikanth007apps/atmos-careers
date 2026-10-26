"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { adminApi, ApiError } from "@/lib/admin-api";
import type { AppSettings } from "@/lib/types";
import { changePasswordSchema } from "@/lib/validation/admin";

type PwValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const { register, handleSubmit, formState, reset, setError } = useForm<PwValues>({ resolver: zodResolver(changePasswordSchema) });
  const e = formState.errors;
  async function onSubmit(values: PwValues) {
    try {
      await adminApi("/api/admin/account/password", "POST", values);
      toast.success("Password changed", { description: "Other devices have been signed out." });
      reset();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.fieldErrors?.currentPassword) setError("currentPassword", { message: apiErr.fieldErrors.currentPassword });
      else toast.error(apiErr.message);
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field id="currentPassword" label="Current password" error={e.currentPassword?.message}>
        <Input id="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!e.currentPassword} {...register("currentPassword")} />
      </Field>
      <Field id="newPassword" label="New password" error={e.newPassword?.message} hint="At least 10 characters, with letters and a number.">
        <Input id="newPassword" type="password" autoComplete="new-password" aria-invalid={!!e.newPassword} {...register("newPassword")} />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={e.confirmPassword?.message}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!e.confirmPassword} {...register("confirmPassword")} />
      </Field>
      <Button type="submit" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="animate-spin" />}Change password
      </Button>
    </form>
  );
}

export function NotificationSettings({ initial, emailConfigured }: { initial: AppSettings; emailConfigured: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial.notifications);
  const [saving, setSaving] = useState(false);
  async function update(next: typeof value) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await adminApi("/api/admin/settings", "PATCH", { notifications: next });
      toast.success("Notification settings saved");
      router.refresh();
    } catch (err) {
      setValue(prev);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const rows = [
    { key: "sendAcknowledgement" as const, label: "Acknowledge new applications", desc: "Email candidates when their application is received." },
    { key: "sendStatusUpdates" as const, label: "Allow status update emails", desc: "Adds an option to email the candidate when you change an application's status." },
  ];
  return (
    <div className="space-y-4">
      {!emailConfigured && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Email isn&apos;t set up on the server. Set <code>EMAIL_ENABLED=true</code> and the SMTP variables to send emails. Until then, no emails are sent.
        </p>
      )}
      {rows.map((r) => (
        <div key={r.key} className="flex items-start justify-between gap-4">
          <div>
            <p id={`${r.key}-label`} className="text-sm font-semibold">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </div>
          <Switch
            aria-labelledby={`${r.key}-label`}
            checked={value[r.key]}
            disabled={!emailConfigured || saving}
            onCheckedChange={(v) => update({ ...value, [r.key]: v })}
          />
        </div>
      ))}
    </div>
  );
}

export function RecalculateStats() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await adminApi<{ stats: { total: number } }>("/api/admin/maintenance", "POST", { task: "recalculate-stats" });
      toast.success(`Counts rebuilt from ${res.stats.total} applications`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recalculate dashboard counts
    </Button>
  );
}
