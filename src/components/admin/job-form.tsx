"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { adminApi, ApiError } from "@/lib/admin-api";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES, type JobStatus } from "@/lib/constants";
import { jobInputSchema, type JobInput, type JobInputParsed } from "@/lib/validation/admin";

type Intent = "draft" | "publish" | "keep";

export interface JobFormDefaults {
  title: string;
  description: string;
  departmentId: string;
  employmentType: string;
  location: string;
  vacancies: string;
  applicationDeadline: string;
}

export function JobForm({
  mode,
  jobId,
  status,
  defaults,
  departments,
}: {
  mode: "create" | "edit";
  jobId?: string;
  status?: JobStatus;
  defaults: JobFormDefaults;
  departments: { id: string; name: string; isActive: boolean }[];
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [formError, setFormError] = useState<string>();
  const [preview, setPreview] = useState(false);
  const { register, control, handleSubmit, formState, setError, watch } = useForm<JobInput, unknown, JobInputParsed>({
    resolver: zodResolver(jobInputSchema),
    defaultValues: defaults as unknown as JobInput,
  });
  const errors = formState.errors;
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  const submit = (chosen: Intent) =>
    handleSubmit(async (values) => {
      setIntent(chosen);
      setFormError(undefined);
      try {
        if (mode === "create") await adminApi("/api/admin/jobs", "POST", { ...values, intent: chosen });
        else await adminApi(`/api/admin/jobs/${jobId}`, "PATCH", { ...values, intent: chosen });
        toast.success(chosen === "publish" ? "Job published" : chosen === "draft" ? "Draft saved" : "Changes saved");
        router.push("/admin/jobs");
        router.refresh();
      } catch (e) {
        const err = e as ApiError;
        Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => setError(k as keyof JobInput, { message }));
        setFormError(err.message);
        toast.error(err.message);
      } finally {
        setIntent(null);
      }
    });

  const busy = intent !== null;
  const spin = (i: Intent) => (intent === i ? <Loader2 className="animate-spin" /> : null);
  const deptName = departments.find((d) => d.id === watch("departmentId"))?.name;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
      {formError && (
        <div role="alert" className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formError}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-lg border bg-card p-5">
          <Field id="title" label="Job title" required error={errors.title?.message}>
            <Input id="title" placeholder="e.g. Senior Site Engineer" aria-invalid={!!errors.title} {...register("title")} />
          </Field>
          <div className="flex flex-col gap-2">
            <span id="description-label" className="text-sm font-semibold">
              Job description<span className="ml-0.5 text-destructive" aria-hidden>*</span>
            </span>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <RichTextEditor
                  id="description"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.description}
                  describedBy={errors.description ? "description-error" : "description-hint"}
                />
              )}
            />
            {errors.description ? (
              <p id="description-error" role="alert" className="text-xs font-medium text-destructive">{errors.description.message}</p>
            ) : (
              <p id="description-hint" className="text-xs text-muted-foreground">Use headings and bullet points for responsibilities, requirements and benefits.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <Field id="departmentId" label="Department" required error={errors.departmentId?.message}>
              <NativeSelect id="departmentId" aria-invalid={!!errors.departmentId} {...register("departmentId")}>
                <option value="">Choose a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} disabled={!d.isActive && d.id !== defaults.departmentId}>
                    {d.name}{d.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {departments.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No departments yet. <Link href="/admin/departments" className="font-semibold underline">Add departments</Link> first.
              </p>
            )}
            <Field id="employmentType" label="Employment type" error={errors.employmentType?.message}>
              <NativeSelect id="employmentType" {...register("employmentType")}>
                <option value="">Not specified</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
              </NativeSelect>
            </Field>
            <Field id="location" label="Location" error={errors.location?.message}>
              <Input id="location" placeholder="e.g. Whitefield, Bengaluru" {...register("location")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="vacancies" label="Vacancies" error={errors.vacancies?.message}>
                <Input id="vacancies" type="number" min={1} max={999} inputMode="numeric" {...register("vacancies")} />
              </Field>
              <Field id="applicationDeadline" label="Apply by" error={errors.applicationDeadline?.message}>
                <Input id="applicationDeadline" type="date" min={today} {...register("applicationDeadline")} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Applications close at 11:59 pm IST on the deadline date. Leave it empty to keep the job open until you close it.</p>
          </div>

          <div className="space-y-2 rounded-lg border bg-card p-5">
            {mode === "create" && (
              <>
                <Button type="button" className="w-full" disabled={busy} onClick={submit("publish")}>{spin("publish")}Publish job</Button>
                <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={submit("draft")}>{spin("draft")}Save as draft</Button>
              </>
            )}
            {mode === "edit" && (
              <>
                <Button type="button" className="w-full" disabled={busy} onClick={submit("keep")}>{spin("keep")}Save changes</Button>
                {status !== "published" && (
                  <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={submit("publish")}>{spin("publish")}Save and publish</Button>
                )}
              </>
            )}
            <Button type="button" variant="ghost" className="w-full" onClick={() => setPreview(true)}><Eye /> Preview</Button>
            <p className="pt-1 text-xs text-muted-foreground">
              {mode === "edit" && status === "published" ? "Changes to a published job appear on the careers site right away." : "Drafts are only visible to admins."}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogDescription>Preview of the careers page{deptName ? `, ${deptName}` : ""}</DialogDescription>
            <DialogTitle className="text-3xl">{watch("title") || "Untitled job"}</DialogTitle>
          </DialogHeader>
          {watch("description") ? (
            <div className="prose-job" dangerouslySetInnerHTML={{ __html: watch("description") }} />
          ) : (
            <p className="text-sm text-muted-foreground">Add a description to see it here.</p>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}
