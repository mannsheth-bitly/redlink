import { ChevronRightIcon, HospitalIcon, InboxIcon, MapPinIcon } from "lucide-react";
import { Link } from "react-router";
import { CompatibilityNote } from "@/components/donor/compatibility-note";
import { RequesterBadge, UrgencyBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { timeAgo, timeUntil } from "@red-link/shared/format";
import type { DonorFeedItem } from "@red-link/shared/api";
import { cn } from "@/lib/utils";

export function FeedList({ items, donorGroup }: { items: DonorFeedItem[]; donorGroup: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
        <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No open requests for you right now</p>
        <p className="text-sm text-muted-foreground">
          When a hospital nearby needs your blood group, it will appear here and you&apos;ll get an alert.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.matchId}>
          <Link
            to={`/donor/requests/${item.requestId}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50",
              item.urgency === "CRITICAL" && "border-primary",
              item.urgency === "URGENT" && "border-warning/60",
            )}
          >
            <BloodGroupPill group={item.bloodGroup} className="text-base" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <UrgencyBadge urgency={item.urgency} />
                {item.matchStatus === "ACCEPTED" ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                    You accepted
                  </span>
                ) : null}
                <RequesterBadge badge={item.badge} />
              </div>
              <p className="mt-1 flex items-center gap-1 truncate font-medium">
                <HospitalIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {item.hospitalName}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3.5" aria-hidden="true" />
                  {item.distanceLabel}
                </span>
                <span>
                  {item.unitsStillNeeded} unit{item.unitsStillNeeded === 1 ? "" : "s"} needed
                </span>
                <span>Needed {timeUntil(item.neededBy)}</span>
                <span>Posted {timeAgo(item.createdAt)}</span>
              </p>
              <CompatibilityNote donorGroup={donorGroup} patientGroup={item.bloodGroup} className="mt-1" />
            </div>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
