import { AlertTriangleIcon, BadgeCheckIcon, Building2Icon, SirenIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

/** Spec 11: NORMAL grey, URGENT amber, CRITICAL red + pulsing. Text is always shown (colour isn't the only signal). */
export function UrgencyBadge({ urgency, className }: { urgency: string; className?: string }) {
  if (urgency === "CRITICAL") {
    return (
      <span className={cn(base, "bg-primary text-primary-foreground", className)}>
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
        </span>
        <SirenIcon className="size-3" aria-hidden="true" />
        Critical
      </span>
    );
  }
  if (urgency === "URGENT") {
    return (
      <span className={cn(base, "bg-warning text-warning-foreground", className)}>
        <AlertTriangleIcon className="size-3" aria-hidden="true" />
        Urgent
      </span>
    );
  }
  return <span className={cn(base, "bg-muted text-muted-foreground", className)}>Normal</span>;
}

const REQUEST_STATUS: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-primary/10 text-primary" },
  PARTIALLY_FULFILLED: { label: "Partly fulfilled", className: "bg-warning/15 text-warning" },
  FULFILLED: { label: "Fulfilled", className: "bg-success/15 text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

export function RequestStatusBadge({ status }: { status: string }) {
  const s = REQUEST_STATUS[status] ?? { label: status, className: "bg-muted" };
  return <span className={cn(base, s.className)}>{s.label}</span>;
}

const MATCH_STATUS: Record<string, { label: string; className: string }> = {
  NOTIFIED: { label: "Notified", className: "bg-muted text-muted-foreground" },
  ACCEPTED: { label: "Accepted", className: "bg-success/15 text-success" },
  DECLINED: { label: "Declined", className: "bg-muted text-muted-foreground line-through" },
  DONATED: { label: "Donated", className: "bg-primary/10 text-primary" },
  NO_LONGER_NEEDED: { label: "No longer needed", className: "bg-muted text-muted-foreground" },
};

export function MatchStatusBadge({ status }: { status: string }) {
  const s = MATCH_STATUS[status] ?? { label: status, className: "bg-muted" };
  return <span className={cn(base, s.className)}>{s.label}</span>;
}

/** Blood group verified by a recorded donation (decision #4). */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, "bg-success/15 text-success", className)} title="Blood group verified at a recorded donation">
      <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
      Verified
    </span>
  );
}

/** Spec 4: "Individual request" vs "Verified institution". */
export function RequesterBadge({ badge }: { badge: "INDIVIDUAL" | "VERIFIED_INSTITUTION" | null }) {
  if (badge === "INDIVIDUAL") {
    return (
      <span className={cn(base, "border bg-background text-muted-foreground")}>
        <UserIcon className="size-3" aria-hidden="true" />
        Individual request
      </span>
    );
  }
  if (badge === "VERIFIED_INSTITUTION") {
    return (
      <span className={cn(base, "border border-success/40 bg-background text-success")}>
        <Building2Icon className="size-3" aria-hidden="true" />
        Verified institution
      </span>
    );
  }
  return null;
}
