"use client";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-normal text-canopy">This page didn&apos;t load</h1>
      <p className="mt-3 text-muted-foreground">There was a problem reaching our servers. Try again in a moment.</p>
      <Button className="mt-8" onClick={reset}>Try again</Button>
    </main>
  );
}
