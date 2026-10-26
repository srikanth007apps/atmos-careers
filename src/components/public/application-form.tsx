"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { contentMatchesKind, detectKindFromBytes, validateResumeMeta } from "@/lib/file-validation";
import { formatBytes } from "@/lib/utils";
import { candidateFieldsSchema } from "@/lib/validation/application";
import { z } from "zod";

type FormInput = z.input<typeof candidateFieldsSchema>;
type FormOutput = z.output<typeof candidateFieldsSchema>;

type Phase = { kind: "idle" } | { kind: "uploading"; percent: number } | { kind: "saving" } | { kind: "done"; reference: string; acknowledged: boolean };

interface SignedUpload {
  uploadUrl: string;
  publicId: string;
  fields: Record<string, string>;
}

class SubmitError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

const NETWORK_MESSAGE = "We couldn't reach the server. Check your internet connection and submit again – your details are still here.";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new SubmitError(NETWORK_MESSAGE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new SubmitError(data.error ?? "Submission failed. Please try again.", data.fieldErrors);
  return data as T;
}

/** XHR (not fetch) so we can report upload progress. */
function uploadToCloudinary(signed: SignedUpload, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    Object.entries(signed.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", signed.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new SubmitError("Your resume could not be uploaded. Please try again."));
    xhr.onerror = () => reject(new SubmitError(NETWORK_MESSAGE));
    xhr.ontimeout = () => reject(new SubmitError("The upload timed out. Please check your connection and try again."));
    xhr.timeout = 120_000;
    xhr.send(form);
  });
}

export function ApplicationForm(props: { jobId: string; jobTitle: string; maxBytes: number; allowWord: boolean; accept: string }) {
  const { jobId, jobTitle, maxBytes, allowWord, accept } = props;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(candidateFieldsSchema),
    defaultValues: { candidateName: "", phone: "", email: "", message: "", consent: false as unknown as true },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, setError, setValue, watch } = form;
  const errors = formState.errors;

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [formError, setFormError] = useState<string>();
  const inFlight = useRef(false);
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  // Remember a successful upload so a retry after a save failure doesn't upload again.
  const uploaded = useRef<{ fileKey: string; publicId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
  const maxMb = Math.round(maxBytes / 1048576);
  const typesLabel = allowWord ? "PDF, DOC or DOCX" : "PDF";

  async function checkFile(f: File): Promise<string | undefined> {
    const meta = validateResumeMeta({ name: f.name, size: f.size, type: f.type }, { maxBytes, allowWord });
    if (!meta.ok) return meta.error;
    const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
    if (!contentMatchesKind(meta.kind, detectKindFromBytes(head))) return `This file doesn't look like a valid ${typesLabel} document.`;
    return undefined;
  }

  async function onFileChange(f: File | null) {
    setFileError(undefined);
    setFile(f);
    if (f) {
      const err = await checkFile(f);
      if (err) setFileError(err);
    }
  }

  async function onSubmit(values: FormOutput) {
    if (inFlight.current) return; // guard against double clicks / double submits
    setFormError(undefined);
    if (!file) {
      setFileError("Please attach your resume");
      return;
    }
    const fileProblem = await checkFile(file);
    if (fileProblem) {
      setFileError(fileProblem);
      return;
    }

    inFlight.current = true;
    try {
      let publicId = uploaded.current?.fileKey === fileKey(file) ? uploaded.current.publicId : null;
      if (!publicId) {
        setPhase({ kind: "uploading", percent: 0 });
        const signed = await postJson<SignedUpload>("/api/uploads/resume-signature", {
          jobId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
        await uploadToCloudinary(signed, file, (percent) => setPhase({ kind: "uploading", percent }));
        publicId = signed.publicId;
        uploaded.current = { fileKey: fileKey(file), publicId };
      }

      setPhase({ kind: "saving" });
      const result = await postJson<{ applicationId: string; acknowledgement: string }>("/api/applications", {
        ...values,
        jobId,
        idempotencyKey: idempotencyKey.current,
        resume: { publicId, originalFileName: file.name },
      });
      setPhase({ kind: "done", reference: result.applicationId.slice(-8).toUpperCase(), acknowledged: result.acknowledgement === "sent" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const e = err instanceof SubmitError ? err : new SubmitError("Something went wrong. Please try again.");
      if (e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          if (field in candidateFieldsSchema.shape) setError(field as keyof FormInput, { message });
        }
      }
      // The server deletes a rejected upload, so the next attempt must upload again.
      uploaded.current = null;
      setFormError(e.message);
      setPhase({ kind: "idle" });
      toast.error("Application not submitted", { description: e.message });
    } finally {
      inFlight.current = false;
    }
  }

  if (phase.kind === "done") {
    return (
      <div role="status" className="mt-10 rounded-lg border border-moss/40 bg-card p-8">
        <CheckCircle2 className="size-10 text-moss" aria-hidden />
        <h2 className="mt-4 text-3xl font-normal text-canopy">Application received</h2>
        <p className="mt-3 leading-relaxed text-foreground/85">
          Thank you. Your application for <strong>{jobTitle}</strong> has been saved and our HR team will review it.
          {phase.acknowledged ? " A confirmation has been sent to your email." : " We'll contact you by phone or email if your profile is a match."}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Reference number: <span className="font-semibold text-foreground">{phase.reference}</span>
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/careers#openings">Back to open positions</Link>
        </Button>
      </div>
    );
  }

  const busy = phase.kind === "uploading" || phase.kind === "saving";
  const consent = watch("consent");

  return (
    <form onSubmit={handleSubmit(onSubmit, () => !file && setFileError("Please attach your resume"))} noValidate className="mt-10 space-y-6" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-6">
        <legend className="sr-only">Your details</legend>
        <Field id="candidateName" label="Full name" required error={errors.candidateName?.message}>
          <Input id="candidateName" autoComplete="name" aria-invalid={!!errors.candidateName} aria-describedby={errors.candidateName ? "candidateName-error" : undefined} {...register("candidateName")} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="phone" label="Phone number" required error={errors.phone?.message} hint="10-digit mobile, or +country code for international">
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : "phone-hint"} {...register("phone")} />
          </Field>
          <Field id="email" label="Email" required error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
          </Field>
        </div>

        <Field id="resume" label="Resume" required error={fileError} hint={`${typesLabel}, up to ${maxMb} MB`}>
          {file ? (
            <div className={`flex items-center gap-3 rounded-md border bg-card px-3 py-3 ${fileError ? "border-destructive" : ""}`}>
              <FileText className="size-5 shrink-0 text-moss" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setFileError(undefined);
                  if (fileInput.current) fileInput.current.value = "";
                }}
                aria-label="Remove selected resume"
              >
                <X /> Remove
              </Button>
            </div>
          ) : (
            <label
              htmlFor="resume"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFileChange(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed bg-card px-4 py-8 text-center hover:bg-accent/50 ${fileError ? "border-destructive" : "border-input"}`}
            >
              <Upload className="size-6 text-moss" aria-hidden />
              <span className="text-sm font-semibold text-canopy">Choose a file</span>
              <span className="text-xs text-muted-foreground">or drag it here</span>
            </label>
          )}
          <input
            ref={fileInput}
            id="resume"
            type="file"
            accept={accept}
            className="sr-only"
            aria-invalid={!!fileError}
            aria-describedby={fileError ? "resume-error" : "resume-hint"}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </Field>

        <Field id="message" label="Message" required error={errors.message?.message} hint="Tell us about your experience and why this role interests you.">
          <Textarea id="message" rows={6} aria-invalid={!!errors.message} aria-describedby={errors.message ? "message-error" : "message-hint"} {...register("message")} />
        </Field>

        <div className="rounded-md bg-limestone/70 p-4 text-sm leading-relaxed text-foreground/85">
          <p>
            <strong className="text-canopy">Privacy notice.</strong> We use your details and resume only to assess your application for this and similar roles.
            They are stored securely, are visible only to our HR team, and are never shared with other candidates. Read our{" "}
            <Link href="/privacy" target="_blank" className="font-semibold underline underline-offset-2">privacy policy</Link>.
          </p>
          <div className="mt-4 flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consent === true}
              onCheckedChange={(v) => setValue("consent", (v === true) as true, { shouldValidate: true, shouldTouch: true })}
              aria-invalid={!!errors.consent}
              aria-describedby={errors.consent ? "consent-error" : undefined}
            />
            <label htmlFor="consent" className="text-sm font-medium">
              I agree to the processing of my personal data for recruitment purposes.<span className="text-destructive" aria-hidden> *</span>
            </label>
          </div>
          {errors.consent && <p id="consent-error" role="alert" className="mt-2 text-xs font-medium text-destructive">{errors.consent.message}</p>}
        </div>
      </fieldset>

      {formError && (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      {busy && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-semibold text-canopy">
            {phase.kind === "uploading" ? `Uploading resume… ${Math.round(phase.percent)}%` : "Saving your application…"}
          </p>
          <Progress value={phase.kind === "uploading" ? phase.percent * 0.9 : 95} label="Submission progress" />
        </div>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {busy ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
