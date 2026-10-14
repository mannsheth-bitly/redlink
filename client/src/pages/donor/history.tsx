import { DropletIcon, HeartPulseIcon } from "lucide-react";
import { EligibilityCard } from "@/components/donor/eligibility-card";
import { UrgencyBadge, VerifiedBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import type { DonationHistoryItem } from "@red-link/shared/api";
import { LIVES_PER_UNIT } from "@red-link/shared/domain/constants";
import { formatDay } from "@red-link/shared/format";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { donorEligibility } from "@/lib/eligibility";
import { usePageTitle } from "@/lib/page-title";

/** Spec 8 /donor/history: donations + total lives impacted (units × 3). */
export default function DonorHistoryPage() {
  usePageTitle("Donation history");
  const user = useUser();
  const { data, error, reload } = useApi<{ history: DonationHistoryItem[]; totalUnits: number; livesImpacted: number }>("/api/donor/history");
  const profile = user.donorProfile!;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Donation history</h1>
        <BloodGroupPill group={profile.bloodGroup} />
        {profile.bloodGroupVerified ? <VerifiedBadge /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <dl className="contents">
          <div className="rounded-xl border bg-card p-4">
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <DropletIcon className="size-4 text-primary" aria-hidden="true" />
              Units donated
            </dt>
            <dd className="text-3xl font-extrabold tabular-nums">{data ? data.totalUnits : "—"}</dd>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <HeartPulseIcon className="size-4 text-primary" aria-hidden="true" />
              Lives impacted
            </dt>
            <dd className="text-3xl font-extrabold tabular-nums">{data ? data.livesImpacted : "—"}</dd>
            <dd className="text-xs text-muted-foreground">Each unit can help up to {LIVES_PER_UNIT} people</dd>
          </div>
        </dl>
        <EligibilityCard eligibility={donorEligibility(user)!} />
      </div>

      {error ? (
        <PageError error={error} onRetry={reload} />
      ) : !data ? (
        <SectionLoading />
      ) : data.history.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No donations recorded yet. When a hospital or blood bank records your donation, it will appear here.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {data.history.map((h) => (
            <li key={h.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-lg leading-none font-extrabold">{h.units}</span>
                <span className="text-[10px] font-medium">unit{h.units === 1 ? "" : "s"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{h.location}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDay(h.donatedAt)} · recorded by {h.recordedBy}
                </p>
              </div>
              {h.requestUrgency ? <UrgencyBadge urgency={h.requestUrgency} /> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
