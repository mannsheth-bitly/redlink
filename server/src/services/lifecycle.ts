import {
  CRITICAL_ESCALATED_RADIUS_KM,
  CRITICAL_ESCALATION_AFTER_MINUTES,
  type BloodGroup,
  type Urgency,
} from "@red-link/shared/domain/constants";
import { canExpandManually, expandedRadiusKm, shouldAutoEscalate } from "@red-link/shared/domain/requests";
import type { CurrentUser } from "../auth.ts";
import { transaction, type TxContext } from "../db.ts";
import { HttpError } from "../http.ts";
import { ACTIVE_STATUSES, BloodRequest, PENDING_MATCH_STATUSES, RequestMatch, type BloodRequestLean } from "../models.ts";
const ACCEPTED_OR_DONATED: ("ACCEPTED" | "DONATED")[] = ["ACCEPTED", "DONATED"];
import { notify } from "../notify.ts";
import { matchAndNotify } from "./matching.ts";
import { declinePendingOffers, requestFollowers } from "./requests.ts";

const ACTIVE = ACTIVE_STATUSES;

const matchable = (r: BloodRequestLean, radiusKm: number) => ({
  id: String(r._id),
  bloodGroup: r.bloodGroup as BloodGroup,
  urgency: r.urgency as Urgency,
  unitsNeeded: r.unitsNeeded,
  hospitalName: r.hospitalName,
  lat: r.lat,
  lng: r.lng,
  radiusKm,
  createdById: String(r.createdById),
});

/**
 * Closes a request as CANCELLED or EXPIRED. Owner decision: donors still notified or
 * accepted become NO_LONGER_NEEDED and are told. Conditional update, so concurrent
 * callers close it only once. Returns false if it was already closed.
 */
export async function closeRequest(
  ctx: TxContext,
  r: BloodRequestLean,
  status: "CANCELLED" | "EXPIRED",
  opts: { reason?: string | null; actorId?: string },
): Promise<boolean> {
  const { modifiedCount } = await BloodRequest.updateOne({ _id: r._id, status: { $in: ACTIVE } }, { status });
  if (modifiedCount === 0) return false;

  const pending = await RequestMatch.find({ requestId: r._id, status: { $in: PENDING_MATCH_STATUSES } }, { donorId: 1 }).lean();
  await RequestMatch.updateMany({ requestId: r._id, status: { $in: PENDING_MATCH_STATUSES } }, { status: "NO_LONGER_NEEDED" });

  const why =
    status === "CANCELLED" ? `was cancelled${opts.reason ? `: "${opts.reason}"` : ""}` : "has closed because its needed-by time passed";
  await notify(
    pending.map((p) => String(p.donorId)),
    {
      type: "REQUEST_UPDATE",
      title: `${r.bloodGroup} request ${status === "CANCELLED" ? "cancelled" : "closed"}`,
      body: `The request at ${r.hospitalName} ${why}. No longer needed, thank you!`,
    },
    ctx,
  );
  await declinePendingOffers(ctx, r, why);

  for (const f of await requestFollowers(r)) {
    if (f.userId === opts.actorId) continue;
    await notify(
      [f.userId],
      {
        type: "REQUEST_UPDATE",
        title: status === "CANCELLED" ? `${r.bloodGroup} request cancelled` : `${r.bloodGroup} request expired`,
        body:
          status === "CANCELLED"
            ? `The request at ${r.hospitalName} was cancelled${opts.reason ? `: "${opts.reason}"` : "."}`
            : `The request at ${r.hospitalName} passed its needed-by time with ${r.unitsFulfilled}/${r.unitsNeeded} units.`,
        link: f.link,
      },
      ctx,
    );
  }
  return true;
}

/** Owner decision: the creator, or the chosen hospital on a receiver's request; optional reason. */
export async function cancelRequest(actor: CurrentUser, requestId: string, reason: string | null) {
  return transaction(async (ctx) => {
    const r = await BloodRequest.findById(requestId).lean();
    if (!r || (String(r.createdById) !== actor.id && String(r.recordingHospitalId) !== actor.id)) {
      throw new HttpError(404, "Request not found.");
    }
    if (!(await closeRequest(ctx, r, "CANCELLED", { reason, actorId: actor.id }))) {
      throw new HttpError(409, "This request is no longer open.");
    }
    return { status: "CANCELLED" as const };
  });
}

/** Spec 5.4: URGENT +25 km, max 75 km. Owner decision: receivers too. Creator only. */
export async function expandRequestRadius(actor: CurrentUser, requestId: string, now = new Date()) {
  return transaction(async (ctx) => {
    const r = await BloodRequest.findById(requestId).lean();
    if (!r || String(r.createdById) !== actor.id) throw new HttpError(404, "Request not found.");
    if (!canExpandManually(r)) {
      throw new HttpError(409, r.urgency !== "URGENT" ? "Only URGENT requests can be expanded manually." : "This request can't be expanded further.");
    }
    const radiusKm = expandedRadiusKm(r.radiusKm);
    // Conditional on the old radius, so a double click expands one step at a time.
    const { modifiedCount } = await BloodRequest.updateOne(
      { _id: r._id, radiusKm: r.radiusKm, status: { $in: ACTIVE } },
      { radiusKm, lastEscalatedAt: now },
    );
    if (modifiedCount === 0) throw new HttpError(409, "The radius was just changed. Refresh and try again.");
    const matches = await matchAndNotify(ctx, matchable(r, radiusKm), now);
    return { radiusKm, newlyNotified: matches.length };
  });
}

async function autoEscalate(r: BloodRequestLean, now: Date) {
  await transaction(async (ctx) => {
    const accepted = await RequestMatch.countDocuments({ requestId: r._id, status: { $in: ACCEPTED_OR_DONATED } });
    if (!shouldAutoEscalate({ ...r, lastEscalatedAt: r.lastEscalatedAt ?? null }, accepted, now)) return;
    // Claim the escalation: only one caller can flip lastEscalatedAt from null.
    const { modifiedCount } = await BloodRequest.updateOne(
      { _id: r._id, lastEscalatedAt: null, status: { $in: ACTIVE } },
      { radiusKm: CRITICAL_ESCALATED_RADIUS_KM, lastEscalatedAt: now },
    );
    if (modifiedCount === 0) return;
    const matches = await matchAndNotify(ctx, matchable(r, CRITICAL_ESCALATED_RADIUS_KM), now);
    for (const f of await requestFollowers(r)) {
      await notify(
        [f.userId],
        {
          type: "REQUEST_UPDATE",
          priority: "CRITICAL",
          title: `Search widened to ${CRITICAL_ESCALATED_RADIUS_KM} km`,
          body: `Fewer than 3 donors accepted the ${r.bloodGroup} request in ${CRITICAL_ESCALATION_AFTER_MINUTES} minutes. ${matches.length} more donor${matches.length === 1 ? "" : "s"} alerted.`,
          link: f.link,
        },
        ctx,
      );
    }
  });
}

/** Swallows conflicts from concurrent maintenance runs; the other run did the work. */
async function quietly(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("[maintenance]", error);
  }
}

/**
 * Lazy expiry + CRITICAL auto-escalation ("checked lazily", spec 5.4/5.7). Runs on request
 * views, feeds and every notifications poll. Safe to run concurrently.
 */
export async function runLazyMaintenance(now = new Date()) {
  const overdue = await BloodRequest.find({ status: { $in: ACTIVE }, neededBy: { $lt: now } }).lean();
  for (const r of overdue) await quietly(() => transaction((ctx) => closeRequest(ctx, r, "EXPIRED", {})));

  const dueBefore = new Date(now.getTime() - CRITICAL_ESCALATION_AFTER_MINUTES * 60_000);
  const critical = await BloodRequest.find({
    urgency: "CRITICAL",
    status: { $in: ACTIVE },
    lastEscalatedAt: null,
    createdAt: { $lte: dueBefore },
    radiusKm: { $lt: CRITICAL_ESCALATED_RADIUS_KM },
  }).lean();
  for (const r of critical) await quietly(() => autoEscalate(r, now));
}
