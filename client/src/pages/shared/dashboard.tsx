import { CheckCircle2Icon, ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react";
import { Link } from "react-router";
import { RequestStatusBadge, UrgencyBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { buttonVariants } from "@/components/ui/button-variants";
import type { RequestSummary } from "@red-link/shared/api";
import { timeAgo, timeUntil } from "@red-link/shared/format";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";

function RequestRow({ r, base }: { r: RequestSummary; base: string }) {
  const pct = Math.min(100, Math.round((r.unitsFulfilled / r.unitsNeeded) * 100));
  return (
    <li>
      <Link to={`${base}/requests/${r.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
        <BloodGroupPill group={r.bloodGroup} className="text-base" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <UrgencyBadge urgency={r.urgency} />
            <RequestStatusBadge status={r.status} />
            <span className="text-xs text-muted-foreground">Created {timeAgo(r.createdAt)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={r.unitsNeeded}
              aria-valuenow={r.unitsFulfilled}
              aria-label={`${r.unitsFulfilled} of ${r.unitsNeeded} units fulfilled`}
            >
              <div className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {r.unitsFulfilled}/{r.unitsNeeded} units
            </span>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-success" aria-hidden="true" />
              {r.acceptedCount} accepted
            </span>
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" aria-hidden="true" />
              {r.matchedCount} matched
            </span>
            {r.isOpen ? <span>Needed {timeUntil(r.neededBy)}</span> : null}
          </p>
        </div>
        <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Spec 8 dashboard: open requests with progress bars, accepted counts and a quick "New request" button. */
export default function DashboardPage({ base, title }: { base: "/hospital" | "/emergency" | "/receiver"; title: string }) {
  usePageTitle(title);
  const user = useUser();
  const { data, error, reload } = useApi<{ requests: RequestSummary[]; patientRequests: RequestSummary[] }>("/api/requests");
  const open = data?.requests.filter((r) => r.isOpen) ?? [];
  const closed = data?.requests.filter((r) => !r.isOpen) ?? [];
  const patient = data?.patientRequests ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{user.institution?.orgName ?? user.name}</p>
        </div>
        <Link to={`${base}/requests/new`} className={buttonVariants({ size: "lg", className: "h-10" })}>
          <PlusIcon />
          New request
        </Link>
      </div>

      {error ? <PageError error={error} onRetry={reload} /> : null}
      {!data && !error ? <SectionLoading /> : null}

      {data ? (
        <section aria-labelledby="open-heading" className="flex flex-col gap-3">
          <h2 id="open-heading" className="text-lg font-semibold">
            Open requests ({open.length})
          </h2>
          {open.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">No open requests</p>
              <p className="text-sm text-muted-foreground">Create a request to alert compatible donors nearby.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {open.map((r) => (
                <RequestRow key={r.id} r={r} base={base} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {patient.length > 0 ? (
        <section aria-labelledby="patient-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="patient-heading" className="text-lg font-semibold">
              Patient requests at your hospital ({patient.filter((r) => r.isOpen).length} open)
            </h2>
            <p className="text-sm text-muted-foreground">
              Raised by patients&apos; families who chose your hospital. Record donations here when donors arrive.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {patient.map((r) => (
              <RequestRow key={r.id} r={r} base={base} />
            ))}
          </ul>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section aria-labelledby="past-heading" className="flex flex-col gap-3">
          <h2 id="past-heading" className="text-lg font-semibold">
            Past requests
          </h2>
          <ul className="flex flex-col gap-3">
            {closed.map((r) => (
              <RequestRow key={r.id} r={r} base={base} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
