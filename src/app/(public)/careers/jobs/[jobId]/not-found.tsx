import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";

export default function JobNotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-normal text-canopy">This position isn&apos;t available</h1>
        <p className="mt-3 text-muted-foreground">It may have been filled or closed. Take a look at the roles that are open right now.</p>
        <Button asChild className="mt-8"><Link href="/careers#openings">See open positions</Link></Button>
      </main>
    </>
  );
}
