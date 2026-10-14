import { ArrowLeftIcon, ClockIcon, HospitalIcon, PhoneIcon, RadarIcon, RefreshCwIcon, ShieldIcon, StickyNoteIcon } from "lucide-react";
import { Link } from "react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MatchStatusBadge, RequestStatusBadge, UrgencyBadge, VerifiedBadge } from "@/components/shared/badges";
import { RequestActions } from "@/components/institution/request-actions";
import { SupplyOffers } from "@/components/institution/supply-offers";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { ReportButton } from "@/components/shared/report-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REQUEST_PAGE_POLL_MS, ROLE_LABEL, type Role } from "@red-link/shared/domain/constants";
import { formatDateTime, timeAgo, timeUntil } from "@red-link/shared/format";
import type { RequestView as RequestViewData } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

type Match = RequestViewData["matches"][number];

function RecordDonationDialog({
  requestId,
  match,
  maxUnits,
  onClose,
  onRecorded,
}: {
  requestId: string;
  match: Match | null;
  maxUnits: number;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [units, setUnits] = useState(1);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!match?.donorId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId: match.donorId, units }),
      });
      const data: { error?: string; status?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't record the donation.");
        return;
      }
      toast.success(data.status === "FULFILLED" ? "Donation recorded. Request fulfilled!" : "Donation recorded");
      onRecorded();
      onClose();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={match !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record donation</DialogTitle>
          <DialogDescription>
            Confirm that {match?.displayName} has donated. This verifies their blood group and starts their 90-day rest
            period.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Units collected</legend>
          <div className="flex gap-2">
            {Array.from({ length: maxUnits }, (_, i) => i + 1).map((n) => (
              <label
                key={n}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input type="radio" name="units" value={n} checked={units === n} onChange={() => setUnits(n)} className="accent-primary" />
                {n} unit{n === 1 ? "" : "s"}
              </label>
            ))}
          </div>
        </fieldset>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Record donation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DonorRow({ m, canRecord, canReport, onRecord }: { m: Match; canRecord: boolean; canReport: boolean; onRecord: () => void }) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3",
        m.status === "ACCEPTED" && "border-success/50",
        (m.status === "DECLINED" || m.status === "NO_LONGER_NEEDED") && "opacity-60",
      )}
    >
      <BloodGroupPill group={m.bloodGroup} />
      {/* min-w keeps the name readable on phones; status, phone and buttons wrap below it. */}
      <div className="min-w-44 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-medium">
          {m.displayName}
          {m.verified ? <VerifiedBadge /> : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {m.distanceLabel} · score {m.score}
          {m.respondedAt ? ` · responded ${timeAgo(m.respondedAt)}` : ""}
        </p>
      </div>
      <MatchStatusBadge status={m.status} />
      {m.phone ? (
        <a
          href={`tel:+91${m.phone}`}
          className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-muted"
          aria-label={`Call ${m.displayName} on ${m.phone}`}
        >
          <PhoneIcon className="size-4 text-success" aria-hidden="true" />
          {m.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
        </a>
      ) : null}
      {m.status === "ACCEPTED" && canRecord ? (
        <Button size="sm" onClick={onRecord}>
          Record donation
        </Button>
      ) : null}
      {canReport && (m.status === "ACCEPTED" || m.status === "DONATED") ? (
        <ReportButton subject={{ kind: "MATCH", matchId: m.id }} about={m.displayName} size="xs" />
      ) : null}
    </li>
  );
}

/** Spec 7.A step 4: live ranked list — accepted (with phone + Record donation), then notified (masked), then declined. */
export function RequestView({ initial, base }: { initial: RequestViewData; base: string }) {
  const [view, setView] = useState(initial);
  const [recording, setRecording] = useState<Match | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${initial.request.id}`, { cache: "no-store" });
      if (!res.ok) return;
      setView(await res.json());
      setLastUpdated(new Date().toISOString());
    } catch {
      // offline: keep showing the last data
    }
  }, [initial.request.id]);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), REQUEST_PAGE_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const { request: r, matches, counts } = view;
  const pct = Math.min(100, Math.round((r.unitsFulfilled / r.unitsNeeded) * 100));
  const canRecord = view.viewer.canRecord && r.isOpen && r.maxUnitsPerDonation > 0;

  const groups: { title: string; items: Match[] }[] = [
    { title: "Donated", items: matches.filter((m) => m.status === "DONATED") },
    { title: "Accepted", items: matches.filter((m) => m.status === "ACCEPTED") },
    { title: "Notified, waiting for a response", items: matches.filter((m) => m.status === "NOTIFIED") },
    { title: "Declined", items: matches.filter((m) => m.status === "DECLINED") },
    { title: "No longer needed", items: matches.filter((m) => m.status === "NO_LONGER_NEEDED") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link to={base} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <BloodGroupPill group={r.bloodGroup} className="px-4 py-2 text-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {r.bloodGroup.replace("-", "−")} · {r.unitsNeeded} unit{r.unitsNeeded === 1 ? "" : "s"}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <UrgencyBadge urgency={r.urgency} />
            <RequestStatusBadge status={r.status} />
          </div>
          {r.raisedBy && view.viewer.isRecordingHospital ? (
            <p className="text-sm text-muted-foreground">
              Patient request raised by {r.raisedBy}. Your hospital records the donations.
            </p>
          ) : null}
          {!view.viewer.canRecord && !view.viewer.isAdmin ? (
            <p className="text-sm text-muted-foreground">
              Donors go to {r.hospitalName}, which records each donation.
            </p>
          ) : null}
        </div>
        {view.viewer.canReportRequest ? (
          <ReportButton subject={{ kind: "REQUEST", requestId: r.id }} about="this patient request" />
        ) : null}
      </div>

      {view.admin ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <ShieldIcon className="size-4 text-primary" aria-hidden="true" />
            Admin view (read-only)
          </p>
          <p>
            Raised by <strong>{view.admin.createdBy.name}</strong> ({ROLE_LABEL[view.admin.createdBy.role as Role] ?? view.admin.createdBy.role}
            {" · "}
            {view.admin.createdBy.email}) · created {formatDateTime(r.createdAt)}
          </p>
          {view.admin.recordingHospital ? <p>Donations recorded by {view.admin.recordingHospital}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-2xl font-extrabold tabular-nums">
              {r.unitsFulfilled}/{r.unitsNeeded}
            </span>
          </div>
          <div
            className="mt-2 h-3 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={r.unitsNeeded}
            aria-valuenow={r.unitsFulfilled}
            aria-label={`${r.unitsFulfilled} of ${r.unitsNeeded} units fulfilled`}
          >
            <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {counts.accepted} accepted · {counts.notified} waiting · {counts.declined} declined · {counts.donated} donated
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-sm">
          <p className="flex items-start gap-2">
            <HospitalIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {r.hospitalName}
              {r.hospitalAddress ? <span className="text-muted-foreground"> · {r.hospitalAddress}</span> : null}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <ClockIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Needed by {formatDateTime(r.neededBy)}
            {r.isOpen ? ` (${timeUntil(r.neededBy)})` : ""}
          </p>
          <p className="flex items-center gap-2">
            <RadarIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Search radius {r.radiusKm} km
          </p>
          {r.patientNote ? (
            <p className="flex items-start gap-2">
              <StickyNoteIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {r.patientNote}
            </p>
          ) : null}
        </div>
      </div>

      <RequestActions view={view} onChanged={() => void refresh()} />

      <SupplyOffers view={view} onChanged={() => void refresh()} />

      <section aria-labelledby="donors-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="donors-heading" className="text-lg font-semibold">
            Matched donors ({matches.length})
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCwIcon className="size-3.5" aria-hidden="true" />
            Updated {timeAgo(lastUpdated)} · refreshes every 10 s
          </button>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">No eligible donors in range</p>
            <p className="text-sm text-muted-foreground">
              No compatible, available and eligible donors were found within {r.radiusKm} km.
            </p>
          </div>
        ) : (
          groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {g.title} ({g.items.length})
                </h3>
                <ul className="flex flex-col gap-2" aria-live={g.title === "Accepted" ? "polite" : undefined}>
                  {g.items.map((m) => (
                    <DonorRow
                      key={m.id}
                      m={m}
                      canRecord={canRecord}
                      canReport={view.viewer.canReportDonors}
                      onRecord={() => setRecording(m)}
                    />
                  ))}
                </ul>
              </div>
            ))
        )}
        <p className="text-xs text-muted-foreground">
          Donor names and phone numbers are shown only after a donor accepts. Distances are approximate.
        </p>
      </section>

      <RecordDonationDialog
        // Remount per donor so the units choice resets to 1.
        key={recording?.id ?? "none"}
        requestId={r.id}
        match={recording}
        maxUnits={r.maxUnitsPerDonation}
        onClose={() => setRecording(null)}
        onRecorded={() => void refresh()}
      />
    </div>
  );
}
