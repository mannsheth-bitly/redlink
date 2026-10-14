import { CircleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api";

/** Loading skeleton for a page or section (spec 11: loading skeletons everywhere). */
export function PageLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SectionLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function PageError({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
      <CircleAlertIcon className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-medium">{error.status === 404 ? "Not found" : "Couldn't load this page"}</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      {onRetry && error.status !== 404 ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
