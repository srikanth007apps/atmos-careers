"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const config = /environment variable|SESSION_SECRET|credential|private key|FIREBASE_|gcloud/i.test(error.message);
  return (
    <div role="alert" className="rounded-lg border bg-card p-8">
      <AlertTriangle className="size-8 text-amber-600" aria-hidden />
      <h1 className="mt-3 text-2xl font-normal text-canopy">This page couldn&apos;t load</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        {config
          ? "The server isn't fully configured. Check the Firebase and Cloudinary environment variables (see README)."
          : "The database didn't respond. Check your connection and try again."}
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p className="mt-3 max-w-2xl rounded-md bg-amber-50 p-3 font-mono text-xs text-amber-900">{error.message}</p>
      )}
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
