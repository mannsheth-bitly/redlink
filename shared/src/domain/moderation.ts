// Admin moderation rules (spec 7.C, 8 /admin). Pure functions with unit tests.
import type { FlagStatus, UserStatus } from "./constants";

export type VerificationAction = "APPROVE" | "REJECT";
export type UserAction = "SUSPEND" | "REACTIVATE";
export type FlagAction = "RESOLVE" | "DISMISS" | "SUSPEND_AND_RESOLVE";

type Result<T> = T | { error: string };

/** Spec 7.C: only a pending institution can be approved (→ ACTIVE) or rejected (→ REJECTED, with a note). */
export function verificationOutcome(
  current: { role: string; status: string },
  action: VerificationAction,
  note: string | null,
): Result<{ status: UserStatus }> {
  if (current.status !== "PENDING_VERIFICATION") return { error: "This account is not waiting for verification." };
  if (action === "REJECT" && !note) return { error: "Add a note explaining why the application was rejected." };
  return { status: action === "APPROVE" ? "ACTIVE" : "REJECTED" };
}

/**
 * Suspend: only ACTIVE, non-admin accounts (pending institutions go through the verification
 * queue instead). Reactivate: only SUSPENDED accounts, back to ACTIVE.
 */
export function userStatusChange(
  target: { id: string; role: string; status: string },
  actorId: string,
  action: UserAction,
): Result<{ from: UserStatus; to: UserStatus }> {
  if (target.id === actorId) return { error: "You can't change your own account." };
  if (target.role === "ADMIN") return { error: "Admin accounts can't be suspended." };
  if (action === "SUSPEND") {
    if (target.status === "SUSPENDED") return { error: "This account is already suspended." };
    if (target.status !== "ACTIVE") return { error: "Only active accounts can be suspended. Use the verification queue for pending institutions." };
    return { from: "ACTIVE", to: "SUSPENDED" };
  }
  if (target.status !== "SUSPENDED") return { error: "This account is not suspended." };
  return { from: "SUSPENDED", to: "ACTIVE" };
}

/** Owner decision: Resolve / Dismiss / Suspend user & resolve, each only on an OPEN flag. */
export function flagOutcome(
  flag: { status: string; hasTarget: boolean },
  action: FlagAction,
): Result<{ status: FlagStatus; suspendTarget: boolean }> {
  if (flag.status !== "OPEN") return { error: "This report has already been reviewed." };
  if (action === "SUSPEND_AND_RESOLVE" && !flag.hasTarget) return { error: "This report isn't about a user." };
  return {
    status: action === "DISMISS" ? "DISMISSED" : "RESOLVED",
    suspendTarget: action === "SUSPEND_AND_RESOLVE",
  };
}

/** The reporter's notification text for each outcome (owner decision: reporters are told). */
export function flagOutcomeMessage(action: FlagAction, note: string | null): { title: string; body: string } {
  const suffix = note ? ` Admin note: "${note}"` : "";
  if (action === "DISMISS") {
    return {
      title: "Your report was reviewed",
      body: `A Red Link admin reviewed your report and found no action was needed.${suffix}`,
    };
  }
  if (action === "SUSPEND_AND_RESOLVE") {
    return {
      title: "Your report was resolved",
      body: `Thank you. A Red Link admin reviewed your report and suspended the account.${suffix}`,
    };
  }
  return { title: "Your report was resolved", body: `Thank you. A Red Link admin reviewed and resolved your report.${suffix}` };
}
