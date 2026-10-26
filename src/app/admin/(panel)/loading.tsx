import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-8 h-28 w-full" />
      <Skeleton className="mt-4 h-72 w-full" />
    </div>
  );
}
