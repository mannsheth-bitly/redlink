import { canDonateTo } from "@red-link/shared/domain/compatibility";
import type { BloodGroup, Role } from "@red-link/shared/domain/constants";
import { isEligible } from "@red-link/shared/domain/eligibility";
import {
  allowedUrgencies,
  initialRadiusKm,
  isActiveStatus,
  maxUnitsForDonation,
  nextMatchStatus,
  requestPathFor,
  statusForUnits,
  type MatchAction,
} from "@red-link/shared/domain/requests";
import type { CreateRequestInput, DonorProfileUpdateInput, ReceiverRequestInput } from "@red-link/shared/validators";
import type { Types } from "mongoose";
import type { CurrentUser } from "../auth.ts";
import { transaction, type TxContext } from "../db.ts";
import { HttpError } from "../http.ts";
import { ACTIVE_STATUSES, BloodRequest, DonationRecord, PENDING_MATCH_STATUSES, RequestMatch, SupplyOffer, User } from "../models.ts";
import { notify } from "../notify.ts";
import { matchAndNotify } from "./matching.ts";


// ---------------------------------------------------------------------------
// Create + broadcast (spec 7.A steps 1–2, 7.B step 5)
// ---------------------------------------------------------------------------

export async function createRequest(
  user: CurrentUser,
  input: CreateRequestInput,
  now = new Date(),
  recordingHospitalId: string | null = null,
) {
  if (!allowedUrgencies(user.role as Role).includes(input.urgency)) {
    throw new HttpError(403, `Your account can't create ${input.urgency} requests.`);
  }
  const neededBy = new Date(input.neededBy);
  if (neededBy.getTime() <= now.getTime()) throw new HttpError(400, "'Needed by' must be in the future.");
  const radiusKm = initialRadiusKm(input.urgency);

  // One transaction: the request, its matches and the donor notifications commit together.
  return transaction(async (ctx) => {
    const [request] = await BloodRequest.create([
      {
        createdById: user.id,
        bloodGroup: input.bloodGroup,
        unitsNeeded: input.unitsNeeded,
        urgency: input.urgency,
        patientNote: input.patientNote || null,
        hospitalName: input.hospitalName,
        hospitalAddress: input.hospitalAddress,
        recordingHospitalId,
        lat: input.lat,
        lng: input.lng,
        radiusKm,
        neededBy,
        createdAt: now,
      },
    ]);
    const id = String(request._id);
    const matches = await matchAndNotify(
      ctx,
      {
        id,
        bloodGroup: input.bloodGroup,
        urgency: input.urgency,
        unitsNeeded: input.unitsNeeded,
        hospitalName: input.hospitalName,
        lat: input.lat,
        lng: input.lng,
        radiusKm,
        createdById: user.id,
      },
      now,
    );
    if (recordingHospitalId) {
      await notify(
        [recordingHospitalId],
        {
          type: "REQUEST_UPDATE",
          priority: input.urgency,
          title: `Patient request at your hospital: ${input.bloodGroup}`,
          body: `${user.name} raised a request for ${input.unitsNeeded} unit${input.unitsNeeded === 1 ? "" : "s"}. Record donations here when donors arrive.`,
          link: requestPathFor("HOSPITAL", id),
        },
        ctx,
      );
    }
    return { id, matchedCount: matches.length, path: requestPathFor(user.role, id) };
  });
}

/** Owner decision: a receiver picks a verified hospital; donors go there and it records donations. */
export async function createReceiverRequest(user: CurrentUser, input: ReceiverRequestInput, now = new Date()) {
  const hospital = await User.findById(input.hospitalId).lean().catch(() => null);
  if (!hospital || hospital.role !== "HOSPITAL" || hospital.status !== "ACTIVE" || !hospital.institution?.verifiedAt) {
    throw new HttpError(400, "Choose a verified hospital from the list.");
  }
  if (hospital.lat == null || hospital.lng == null) throw new HttpError(400, "That hospital has no location set.");
  return createRequest(
    user,
    {
      bloodGroup: input.bloodGroup,
      unitsNeeded: input.unitsNeeded,
      urgency: input.urgency,
      neededBy: input.neededBy,
      patientNote: input.patientNote,
      hospitalName: hospital.institution.orgName,
      hospitalAddress: hospital.address ?? "",
      lat: hospital.lat,
      lng: hospital.lng,
    },
    now,
    String(hospital._id),
  );
}

/** The requester, plus the recording hospital for receiver-raised requests. */
export async function requestFollowers(r: { _id: unknown; createdById: unknown; recordingHospitalId?: unknown }) {
  const creator = await User.findById(r.createdById, { role: 1 }).lean();
  const id = String(r._id);
  return [
    { userId: String(r.createdById), link: requestPathFor(creator?.role ?? "", id) },
    ...(r.recordingHospitalId ? [{ userId: String(r.recordingHospitalId), link: requestPathFor("HOSPITAL", id) }] : []),
  ];
}

// ---------------------------------------------------------------------------
// Donor accept / decline / withdraw (spec 7.A step 3)
// ---------------------------------------------------------------------------

export async function respondToMatch(donorId: string, matchId: string, action: MatchAction, now = new Date()) {
  return transaction(async (ctx) => {
    const match = await RequestMatch.findById(matchId).lean();
    if (!match || String(match.donorId) !== donorId) throw new HttpError(404, "Request not found.");
    const request = await BloodRequest.findById(match.requestId).lean();
    const donor = await User.findById(donorId).lean();
    if (!request || !donor?.donorProfile) throw new HttpError(404, "Request not found.");

    const next = nextMatchStatus(match.status, action, request.status);
    if ("error" in next) throw new HttpError(409, next.error);

    if (next.status === "ACCEPTED") {
      const e = isEligible({ status: donor.status, ...donor.donorProfile, lastDonationAt: donor.donorProfile.lastDonationAt ?? null }, now);
      if (!e.eligible) throw new HttpError(409, e.reason ?? "You are not eligible to donate right now.");
      if (!canDonateTo(donor.donorProfile.bloodGroup as BloodGroup, request.bloodGroup as BloodGroup)) {
        throw new HttpError(409, "Your blood group is not compatible with this request.");
      }
    }

    // Conditional on the old status, so a double tap can't apply twice.
    const { modifiedCount } = await RequestMatch.updateOne(
      { _id: match._id, status: match.status },
      { status: next.status, respondedAt: now },
    );
    if (modifiedCount === 0) throw new HttpError(409, "Your response was already saved. Refresh the page.");

    const withdrawing = match.status === "ACCEPTED" && next.status === "DECLINED";
    if (next.status === "ACCEPTED" || withdrawing) {
      for (const f of await requestFollowers(request)) {
        await notify(
          [f.userId],
          next.status === "ACCEPTED"
            ? {
                type: "REQUEST_UPDATE",
                title: `A donor accepted the ${request.bloodGroup} request`,
                body: `${donor.name} accepted and will come to ${request.hospitalName}.`,
                link: f.link,
              }
            : {
                type: "REQUEST_UPDATE",
                title: `A donor withdrew from the ${request.bloodGroup} request`,
                body: `${donor.name} can no longer donate for this request.`,
                link: f.link,
              },
          ctx,
        );
      }
    }
    return { status: next.status };
  });
}

// ---------------------------------------------------------------------------
// Record donation (spec 7.A step 5 + 5.7)
// ---------------------------------------------------------------------------

export async function recordDonation(actor: CurrentUser, requestId: string, donorId: string, units: number, now = new Date()) {
  return transaction(async (ctx) => {
    const request = await BloodRequest.findById(requestId).lean();
    // The creating hospital/emergency service, or the hospital chosen on a receiver's request.
    const allowed = request && (String(request.createdById) === actor.id || String(request.recordingHospitalId) === actor.id);
    if (!request || !allowed) throw new HttpError(404, "Request not found.");
    if (!isActiveStatus(request.status)) throw new HttpError(409, "This request is no longer open.");

    const maxUnits = maxUnitsForDonation(request);
    if (units < 1 || units > maxUnits) {
      throw new HttpError(400, `You can record ${maxUnits === 1 ? "1 unit" : `1–${maxUnits} units`} for this request.`);
    }
    const match = await RequestMatch.findOne({ requestId, donorId }).lean();
    if (!match) throw new HttpError(404, "This donor isn't matched to the request.");
    if (match.status !== "ACCEPTED") throw new HttpError(409, "Only donors who accepted can be recorded.");

    await DonationRecord.create([{ donorId, requestId, recordedById: actor.id, units, donatedAt: now, location: request.hospitalName }]);
    await RequestMatch.updateOne({ _id: match._id }, { status: "DONATED" });
    // Recording a donation verifies the blood group and starts the 90-day cooldown.
    await User.updateOne({ _id: donorId }, { "donorProfile.lastDonationAt": now, "donorProfile.bloodGroupVerified": true });
    const { unitsFulfilled, status } = await addUnitsToRequest(ctx, request, units, now);

    await notify(
      [donorId],
      {
        type: "REQUEST_UPDATE",
        title: "Thank you for donating!",
        body: `Your donation at ${request.hospitalName} has been recorded. Your blood group is now verified.`,
        link: "/donor/history",
      },
      ctx,
    );
    if (String(request.createdById) !== actor.id) {
      const [creator] = await requestFollowers(request);
      await notify(
        [creator.userId],
        {
          type: "REQUEST_UPDATE",
          title: status === "FULFILLED" ? `Your ${request.bloodGroup} request is fulfilled` : "A donation was recorded",
          body: `${request.hospitalName} recorded ${units} unit${units === 1 ? "" : "s"} (${unitsFulfilled}/${request.unitsNeeded}).`,
          link: creator.link,
        },
        ctx,
      );
    }
    return { unitsFulfilled, status };
  });
}

/**
 * Spec 5.7, shared by recorded donations and accepted supply offers: raise unitsFulfilled
 * and update the status. When the request becomes FULFILLED, tell every matched donor who
 * hasn't donated "No longer needed, thank you!" and decline other pending supply offers.
 * The update is conditional on the old value, so concurrent writers can't lose units.
 */
export async function addUnitsToRequest(
  ctx: TxContext,
  request: { _id: Types.ObjectId; bloodGroup: string; hospitalName: string; unitsFulfilled: number; unitsNeeded: number },
  units: number,
  now: Date,
) {
  const unitsFulfilled = request.unitsFulfilled + units;
  const status = statusForUnits(unitsFulfilled, request.unitsNeeded);
  const { modifiedCount } = await BloodRequest.updateOne(
    { _id: request._id, unitsFulfilled: request.unitsFulfilled, status: { $in: ACTIVE_STATUSES } },
    { unitsFulfilled, status, fulfilledAt: status === "FULFILLED" ? now : null },
  );
  if (modifiedCount === 0) throw new HttpError(409, "This request just changed. Refresh and try again.");
  if (status !== "FULFILLED") return { unitsFulfilled, status };

  const pending = await RequestMatch.find({ requestId: request._id, status: { $in: PENDING_MATCH_STATUSES } }, { donorId: 1 }).lean();
  await RequestMatch.updateMany({ requestId: request._id, status: { $in: PENDING_MATCH_STATUSES } }, { status: "NO_LONGER_NEEDED" });
  await notify(
    pending.map((p) => String(p.donorId)),
    {
      type: "REQUEST_UPDATE",
      title: `${request.bloodGroup} request fulfilled`,
      body: `The request at ${request.hospitalName} has been fulfilled. No longer needed, thank you!`,
    },
    ctx,
  );
  await declinePendingOffers(ctx, request, "has been fulfilled. Thank you for offering");
  return { unitsFulfilled, status };
}

/** Declines a closed request's pending supply offers and tells the blood banks. */
export async function declinePendingOffers(
  ctx: TxContext,
  request: { _id: Types.ObjectId; bloodGroup: string; hospitalName: string },
  why: string,
) {
  const offers = await SupplyOffer.find({ requestId: request._id, status: "PENDING" }, { bloodBankId: 1 }).lean();
  if (offers.length === 0) return;
  await SupplyOffer.updateMany({ requestId: request._id, status: "PENDING" }, { status: "DECLINED" });
  await notify(
    offers.map((o) => String(o.bloodBankId)),
    {
      type: "SUPPLY_OFFER",
      title: "Your supply offer is no longer needed",
      body: `The ${request.bloodGroup} request at ${request.hospitalName} ${why}.`,
      link: "/bloodbank/requests",
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------
// Donor availability & profile
// ---------------------------------------------------------------------------

export async function setAvailability(donorId: string, isAvailable: boolean) {
  await User.updateOne({ _id: donorId, role: "DONOR" }, { "donorProfile.isAvailable": isAvailable });
}

/**
 * Owner decision: donors can edit every field. Changing the blood group removes the Verified
 * badge and withdraws the donor from open requests they're no longer compatible with.
 */
export async function updateDonorProfile(donorId: string, input: DonorProfileUpdateInput) {
  return transaction(async (ctx) => {
    const current = await User.findById(donorId).lean();
    if (!current?.donorProfile) throw new HttpError(404, "Donor profile not found.");
    if (input.email !== current.email && (await User.exists({ email: input.email }))) {
      throw new HttpError(409, "Another account already uses this email.");
    }
    const groupChanged = input.bloodGroup !== current.donorProfile.bloodGroup;
    const now = new Date();
    await User.updateOne(
      { _id: donorId },
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        lat: input.location.lat,
        lng: input.location.lng,
        address: input.location.address,
        city: input.location.city,
        pincode: input.location.pincode,
        "donorProfile.bloodGroup": input.bloodGroup,
        "donorProfile.dateOfBirth": new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        "donorProfile.gender": input.gender,
        "donorProfile.weightKg": input.weightKg,
        "donorProfile.lastDonationAt": input.lastDonationAt ? new Date(`${input.lastDonationAt}T00:00:00.000Z`) : null,
        ...(groupChanged ? { "donorProfile.bloodGroupVerified": false } : {}),
      },
    );
    if (!groupChanged) return;

    const active = await RequestMatch.find({ donorId, status: { $in: PENDING_MATCH_STATUSES } }).lean();
    for (const m of active) {
      const r = await BloodRequest.findById(m.requestId).lean();
      if (!r || !isActiveStatus(r.status) || canDonateTo(input.bloodGroup, r.bloodGroup as BloodGroup)) continue;
      await RequestMatch.updateOne({ _id: m._id }, { status: "DECLINED", respondedAt: now });
      if (m.status === "ACCEPTED") {
        for (const f of await requestFollowers(r)) {
          await notify(
            [f.userId],
            {
              type: "REQUEST_UPDATE",
              title: `A donor withdrew from the ${r.bloodGroup} request`,
              body: `${input.name} updated their blood group and is no longer compatible.`,
              link: f.link,
            },
            ctx,
          );
        }
      }
    }
  });
}
