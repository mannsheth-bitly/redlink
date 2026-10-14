import type { Role } from "@red-link/shared/domain/constants";

export const USER_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-success/15 text-success" },
  PENDING_VERIFICATION: { label: "Pending verification", className: "bg-warning/15 text-warning" },
  SUSPENDED: { label: "Suspended", className: "bg-destructive/15 text-destructive" },
  REJECTED: { label: "Rejected", className: "bg-muted text-muted-foreground" },
};

/** What suspending does, per role (owner decision "clean up + block"). */
export const SUSPEND_EFFECT: Partial<Record<Role, string>> = {
  DONOR: "They're withdrawn from requests they were alerted for or accepted (requesters are told), and pending contact requests are declined.",
  RECEIVER: "Their open requests are cancelled (alerted donors are told), and their pending contact requests are closed.",
  HOSPITAL: "Their open requests, and open patient requests that chose this hospital, are cancelled. Donors and patients are told.",
  EMERGENCY: "Their open requests are cancelled and alerted donors are told.",
  BLOOD_BANK: "Their pending supply offers are withdrawn (requesters are told) and their donation camps are hidden.",
};

export interface SuspensionSummary {
  cancelledRequests: number;
  withdrawnMatches: number;
  declinedContacts: number;
  withdrawnOffers: number;
}

/** " 2 requests cancelled, 1 contact request closed." for the success toast. */
export function describeSummary(s: SuspensionSummary | null): string {
  if (!s) return "";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [
    s.cancelledRequests ? `${plural(s.cancelledRequests, "request")} cancelled` : "",
    s.withdrawnMatches ? `withdrawn from ${plural(s.withdrawnMatches, "request")}` : "",
    s.declinedContacts ? `${plural(s.declinedContacts, "contact request")} closed` : "",
    s.withdrawnOffers ? `${plural(s.withdrawnOffers, "supply offer")} withdrawn` : "",
  ].filter(Boolean);
  return parts.length ? ` ${parts.join(", ")}.` : "";
}
