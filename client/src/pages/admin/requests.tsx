import { CheckCircle2Icon, ChevronRightIcon, ClipboardListIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { RequestStatusBadge, UrgencyBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { AdminRequestRow } from "@red-link/shared/api";
import { ROLE_LABEL, type Role } from "@red-link/shared/domain/constants";
import { formatDateTime } from "@red-link/shared/format";
import { useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";

const FILTERS = [
  { value: "ACTIVE", label: "Open (incl. partly fulfilled)" },
  { value: "", label: "All requests" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

/** Owner decision: read-only list of every request; each opens the full ranked view with accepted donors' phones. */
export default function AdminRequestsPage() {
  usePageTitle("All requests");
  const [status, setStatus] = useState("ACTIVE");
  const { data, error, reload } = useApi<{ requests: AdminRequestRow[] }>(`/api/admin/requests${status ? `?status=${status}` : ""}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All requests</h1>
          <p className="text-muted-foreground">Read-only. Open a request to see its donors and the phone numbers of those who accepted.</p>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="req-status">Show</Label>
          <NativeSelect id="req-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {error ? <PageError error={error} onRetry={reload} /> : null}
      {!data && !error ? <SectionLoading /> : null}

      {data && data.requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <ClipboardListIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No requests</p>
          <p className="text-sm text-muted-foreground">Nothing matches this filter.</p>
        </div>
      ) : null}

      {data && data.requests.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.requests.map((r) => (
            <li key={r.id}>
              <Link to={`/admin/requests/${r.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50">
                <BloodGroupPill group={r.bloodGroup} className="text-base" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <UrgencyBadge urgency={r.urgency} />
                    <RequestStatusBadge status={r.status} />
                    <span className="text-sm font-semibold tabular-nums">
                      {r.unitsFulfilled}/{r.unitsNeeded} units
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{r.hospitalName}</p>
                  <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    <span>
                      By {r.createdByName} ({ROLE_LABEL[r.createdByRole as Role] ?? r.createdByRole})
                    </span>
                    <span>{formatDateTime(r.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2Icon className="size-3.5 text-success" aria-hidden="true" />
                      {r.acceptedCount} accepted
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" aria-hidden="true" />
                      {r.matchedCount} matched
                    </span>
                  </p>
                </div>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
