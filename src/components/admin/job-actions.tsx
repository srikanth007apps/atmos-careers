"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import type { JobStatus } from "@/lib/constants";

type Action = "publish" | "close" | "reopen" | "unpublish";
const DONE: Record<Action, string> = { publish: "Job published", close: "Job closed", reopen: "Job reopened", unpublish: "Moved to drafts" };

export function JobActions({
  jobId,
  title,
  status,
  applications,
  variant = "row",
  afterDelete = "refresh",
  showEdit = true,
}: {
  jobId: string;
  title: string;
  status: JobStatus;
  applications: number;
  variant?: "row" | "page";
  afterDelete?: "refresh" | "list";
  showEdit?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    try {
      await adminApi(`/api/admin/jobs/${jobId}/status`, "POST", { action });
      toast.success(DONE[action]);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await adminApi(`/api/admin/jobs/${jobId}`, "DELETE");
      toast.success("Job deleted");
      if (afterDelete === "list") router.replace("/admin/jobs");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const size = variant === "row" ? "sm" : "default";
  const spin = (a: string) => (busy === a ? <Loader2 className="animate-spin" /> : null);

  return (
    <div className={variant === "row" ? "flex flex-wrap justify-end gap-1.5" : "flex flex-wrap gap-2"}>
      {showEdit && (
        <Button asChild variant="outline" size={size}>
          <Link href={`/admin/jobs/${jobId}/edit`}><Pencil /> Edit</Link>
        </Button>
      )}
      <Button asChild variant="ghost" size={size}>
        <Link href={`/admin/jobs/${jobId}/preview`}><Eye /> Preview</Link>
      </Button>
      {status === "draft" && (
        <Button size={size} disabled={!!busy} onClick={() => run("publish")}>{spin("publish")}Publish</Button>
      )}
      {status === "published" && (
        <>
          <Button variant="outline" size={size} disabled={!!busy} onClick={() => run("unpublish")}>{spin("unpublish")}Unpublish</Button>
          <Button variant="secondary" size={size} disabled={!!busy} onClick={() => run("close")}>{spin("close")}Close</Button>
        </>
      )}
      {status === "closed" && (
        <Button variant="secondary" size={size} disabled={!!busy} onClick={() => run("reopen")}>{spin("reopen")}Reopen</Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size={size} className="text-destructive hover:bg-destructive/10" disabled={!!busy} aria-label={`Delete ${title}`}>
            {spin("delete") ?? <Trash2 />}
            {variant === "page" && "Delete"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The posting will be removed from the careers site permanently.{" "}
              {applications > 0
                ? `Its ${applications} application${applications === 1 ? "" : "s"} will be kept and stay available under Candidate applications.`
                : "It has no applications."}{" "}
              To stop new applications but keep the posting, close it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>
              Delete job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
