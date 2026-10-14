import { ArrowLeftIcon, ClockIcon, HospitalIcon, MapPinIcon, StickyNoteIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { CompatibilityNote } from "@/components/donor/compatibility-note";
import { RespondButtons } from "@/components/donor/respond-buttons";
import { MatchStatusBadge, RequesterBadge, RequestStatusBadge, UrgencyBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { ReportButton } from "@/components/shared/report-button";
import { Card, CardContent } from "@/components/ui/card";
import type { DonorRequestDetail } from "@red-link/shared/api";
import { canDonateTo } from "@red-link/shared/domain/compatibility";
import type { BloodGroup } from "@red-link/shared/domain/constants";
import { formatDateTime, timeAgo, timeUntil } from "@red-link/shared/format";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { donorEligibility } from "@/lib/eligibility";
import { usePageTitle } from "@/lib/page-title";

const FINAL_MESSAGES: Record<string, string> = {
  DONATED: "Your donation for this request has been recorded. Thank you!",
  NO_LONGER_NEEDED: "This request no longer needs donors. Thank you for being ready to help!",
};

export default function DonorRequestPage() {
  usePageTitle("Blood request");
  const { id } = useParams();
  const user = useUser();
  const { data: detail, error, reload } = useApi<DonorRequestDetail>(`/api/requests/${id}`);

  const back = (
    <Link to="/donor" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      Back to home
    </Link>
  );
  if (error) return <div className="mx-auto flex max-w-2xl flex-col gap-5">{back}<PageError error={error} onRetry={reload} /></div>;
  if (!detail) return <div className="mx-auto max-w-2xl"><SectionLoading /></div>;

  const { request: r, matchStatus } = detail;
  const profile = user.donorProfile!;
  const eligibility = donorEligibility(user)!;
  const compatible = canDonateTo(profile.bloodGroup as BloodGroup, r.bloodGroup as BloodGroup);
  const canAccept = r.isOpen && eligibility.eligible && compatible;
  const cannotAcceptReason = !r.isOpen ? null : !compatible ? "Your blood group is not compatible with this request." : eligibility.reason;
  const canRespond = r.isOpen && (matchStatus === "NOTIFIED" || matchStatus === "ACCEPTED" || matchStatus === "DECLINED");
  const stillNeeded = Math.max(0, r.unitsNeeded - r.unitsFulfilled);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {back}

      <div className="flex items-start gap-4">
        <BloodGroupPill group={r.bloodGroup} className="px-4 py-2 text-2xl" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {stillNeeded} unit{stillNeeded === 1 ? "" : "s"} of {r.bloodGroup.replace("-", "−")} needed
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <UrgencyBadge urgency={r.urgency} />
            <RequestStatusBadge status={r.status} />
            <MatchStatusBadge status={matchStatus} />
            <RequesterBadge badge={r.badge} />
          </div>
          <CompatibilityNote donorGroup={profile.bloodGroup} patientGroup={r.bloodGroup} className="text-sm" />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="flex items-start gap-2">
            <HospitalIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="block font-semibold">{r.hospitalName}</span>
              {/* Owner decision: the server only sends the address once the donor has accepted. */}
              {r.hospitalAddress ? <span className="block text-muted-foreground">{r.hospitalAddress}</span> : null}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <MapPinIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {detail.distanceLabel} from you
          </p>
          <p className="flex items-center gap-2">
            <ClockIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Needed by {formatDateTime(r.neededBy)} ({timeUntil(r.neededBy)}) · posted {timeAgo(r.createdAt)}
          </p>
          {r.patientNote ? (
            <p className="flex items-start gap-2">
              <StickyNoteIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {r.patientNote}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {matchStatus === "ACCEPTED" && r.isOpen ? (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          <p className="font-semibold">You&apos;ve accepted this request.</p>
          <p>
            Please go to <strong>{r.hospitalName}</strong>
            {r.hospitalAddress ? ` (${r.hospitalAddress})` : ""}. The hospital can see your phone number and may call you.
          </p>
        </div>
      ) : null}

      {FINAL_MESSAGES[matchStatus] ? (
        <p className="rounded-xl border bg-muted p-4 text-sm">{FINAL_MESSAGES[matchStatus]}</p>
      ) : !r.isOpen ? (
        <p className="rounded-xl border bg-muted p-4 text-sm">This request is no longer open.</p>
      ) : null}

      {canRespond ? (
        <RespondButtons matchId={detail.matchId} status={matchStatus} canAccept={canAccept} cannotAcceptReason={cannotAcceptReason} />
      ) : null}

      <div className="flex justify-end">
        <ReportButton subject={{ kind: "REQUEST", requestId: r.id }} about="this request" />
      </div>
    </div>
  );
}
