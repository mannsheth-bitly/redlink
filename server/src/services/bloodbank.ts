import type { CampRow, InventoryTile, SupplyableRequest, WalkInDonor } from "@red-link/shared/api";
import { canDonateTo } from "@red-link/shared/domain/compatibility";
import { BLOOD_BANK_SUPPLY_RADIUS_KM, type BloodGroup } from "@red-link/shared/domain/constants";
import { formatPublicDistance, haversineKm } from "@red-link/shared/domain/geo";
import {
  adjustedUnits,
  fullInventory,
  isLowStock,
  maxOfferUnits,
  offerableGroups,
  unitsToApply,
  walkInEligibility,
} from "@red-link/shared/domain/inventory";
import { isActiveStatus, unitsRemaining } from "@red-link/shared/domain/requests";
import type { CurrentUser } from "../auth.ts";
import { transaction } from "../db.ts";
import { HttpError } from "../http.ts";
import { ACTIVE_STATUSES, BloodRequest, DonationCamp, DonationRecord, InventoryItem, SupplyOffer, User } from "../models.ts";
import { notify } from "../notify.ts";
import { addUnitsToRequest, requestFollowers } from "./requests.ts";

const DEFAULT_THRESHOLD = 5;
const show = (g: string) => g.replace("-", "−");

// ---------------------------------------------------------------------------
// Inventory (spec 8: 8-tile grid, low stock in red, quick adjust)
// ---------------------------------------------------------------------------

export async function getInventory(bankId: string): Promise<InventoryTile[]> {
  const rows = await InventoryItem.find({ bloodBankId: bankId }).lean();
  return fullInventory(rows, DEFAULT_THRESHOLD).map((i) => ({ ...i, low: isLowStock(i) }));
}

export async function updateInventory(
  bankId: string,
  input: { bloodGroup: BloodGroup; delta?: number; units?: number; lowStockThreshold?: number },
) {
  await transaction(async () => {
    const current = await InventoryItem.findOne({ bloodBankId: bankId, bloodGroup: input.bloodGroup }).lean();
    const units = input.units ?? adjustedUnits(current?.units ?? 0, input.delta ?? 0);
    await InventoryItem.updateOne(
      { bloodBankId: bankId, bloodGroup: input.bloodGroup },
      {
        units,
        lowStockThreshold: input.lowStockThreshold ?? current?.lowStockThreshold ?? DEFAULT_THRESHOLD,
        updatedAt: new Date(),
      },
      { upsert: true },
    );
  });
  return getInventory(bankId);
}

// ---------------------------------------------------------------------------
// Open requests the bank can supply (spec 7.D step 1)
// ---------------------------------------------------------------------------

export async function getSupplyableRequests(bank: CurrentUser, now = new Date()): Promise<SupplyableRequest[]> {
  if (bank.lat === null || bank.lng === null) return [];
  const origin = { lat: bank.lat, lng: bank.lng };
  const [stock, requests, myOffers] = await Promise.all([
    InventoryItem.find({ bloodBankId: bank.id }).lean(),
    BloodRequest.find({ status: { $in: ACTIVE_STATUSES }, neededBy: { $gt: now } }).sort({ createdAt: -1 }).lean(),
    SupplyOffer.find({ bloodBankId: bank.id }).lean(),
  ]);
  const creators = await User.find({ _id: { $in: requests.map((r) => r.createdById) } }, { role: 1 }).lean();
  const roleOf = new Map(creators.map((c) => [String(c._id), c.role]));

  return requests
    .map((r) => ({ r, distanceKm: haversineKm(origin, r) }))
    .filter(({ distanceKm }) => distanceKm <= BLOOD_BANK_SUPPLY_RADIUS_KM)
    .map(({ r, distanceKm }) => {
      const stillNeeded = unitsRemaining(r);
      const mine = myOffers.filter((o) => String(o.requestId) === String(r._id));
      const myOffer = mine.find((o) => o.status === "PENDING") ?? mine.find((o) => o.status === "ACCEPTED") ?? null;
      return {
        id: String(r._id),
        bloodGroup: r.bloodGroup,
        urgency: r.urgency,
        hospitalName: r.hospitalName,
        unitsNeeded: r.unitsNeeded,
        unitsFulfilled: r.unitsFulfilled,
        stillNeeded,
        neededBy: r.neededBy.toISOString(),
        distanceKm,
        distanceLabel: formatPublicDistance(distanceKm),
        isIndividual: roleOf.get(String(r.createdById)) === "RECEIVER",
        options: offerableGroups(r.bloodGroup as BloodGroup, stock).map((o) => ({ ...o, maxUnits: maxOfferUnits(o.units, stillNeeded) })),
        myOffer: myOffer ? { id: String(myOffer._id), status: myOffer.status, units: myOffer.units, bloodGroup: myOffer.bloodGroup } : null,
      };
    })
    // Spec 7.D: only requests where the bank has compatible stock (or already offered).
    .filter((x) => x.options.length > 0 || x.myOffer !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// ---------------------------------------------------------------------------
// Supply offers (spec 7.D)
// ---------------------------------------------------------------------------

export async function createSupplyOffer(bank: CurrentUser, requestId: string, bloodGroup: BloodGroup, units: number) {
  if (bank.lat === null || bank.lng === null) throw new HttpError(400, "Set your blood bank's location first.");
  return transaction(async (ctx) => {
    const r = await BloodRequest.findById(requestId).lean().catch(() => null);
    if (!r || !isActiveStatus(r.status)) throw new HttpError(409, "This request is no longer open.");
    if (haversineKm({ lat: bank.lat!, lng: bank.lng! }, r) > BLOOD_BANK_SUPPLY_RADIUS_KM) {
      throw new HttpError(400, `This request is more than ${BLOOD_BANK_SUPPLY_RADIUS_KM} km away.`);
    }
    if (!canDonateTo(bloodGroup, r.bloodGroup as BloodGroup)) {
      throw new HttpError(400, `${show(bloodGroup)} is not compatible with a ${show(r.bloodGroup)} patient.`);
    }
    if (await SupplyOffer.exists({ requestId, bloodBankId: bank.id, status: "PENDING" })) {
      throw new HttpError(409, "You already have a pending offer on this request.");
    }
    const stock = await InventoryItem.findOne({ bloodBankId: bank.id, bloodGroup }).lean();
    const max = maxOfferUnits(stock?.units ?? 0, unitsRemaining(r));
    if (units < 1 || units > max) {
      throw new HttpError(400, max === 0 ? `You have no ${show(bloodGroup)} units to offer.` : `You can offer 1–${max} units of ${show(bloodGroup)}.`);
    }
    const [offer] = await SupplyOffer.create([{ requestId, bloodBankId: bank.id, bloodGroup, units }]);
    const orgName = bank.institution?.orgName ?? bank.name;
    for (const f of await requestFollowers(r)) {
      await notify(
        [f.userId],
        {
          type: "SUPPLY_OFFER",
          priority: r.urgency === "NORMAL" ? "NORMAL" : "URGENT",
          title: `${orgName} offered ${units} unit${units === 1 ? "" : "s"}`,
          body: `${units} unit${units === 1 ? "" : "s"} of ${show(bloodGroup)} for your ${show(r.bloodGroup)} request. Accept the offer on the request page.`,
          link: f.link,
        },
        ctx,
      );
    }
    return { id: String(offer._id) };
  });
}

/** Spec 7.D step 2: requester accepts → stock down, units up. Owner decision: receiver or chosen hospital. */
export async function respondToSupplyOffer(actor: CurrentUser, offerId: string, action: "ACCEPT" | "DECLINE", now = new Date()) {
  return transaction(async (ctx) => {
    const offer = await SupplyOffer.findById(offerId).lean();
    const r = offer ? await BloodRequest.findById(offer.requestId).lean() : null;
    if (!offer || !r || (String(r.createdById) !== actor.id && String(r.recordingHospitalId) !== actor.id)) {
      throw new HttpError(404, "Offer not found.");
    }
    if (offer.status !== "PENDING") throw new HttpError(409, "This offer has already been answered.");
    if (!isActiveStatus(r.status)) throw new HttpError(409, "This request is no longer open.");
    const bank = await User.findById(offer.bloodBankId, { name: 1, institution: 1 }).lean();
    const bankName = bank?.institution?.orgName ?? bank?.name ?? "The blood bank";

    if (action === "DECLINE") {
      await SupplyOffer.updateOne({ _id: offer._id, status: "PENDING" }, { status: "DECLINED" });
      await notify(
        [String(offer.bloodBankId)],
        { type: "SUPPLY_OFFER", title: "Supply offer declined", body: `Your offer for the ${show(r.bloodGroup)} request at ${r.hospitalName} was declined.`, link: "/bloodbank/requests" },
        ctx,
      );
      return { status: "DECLINED" as const };
    }

    const applied = unitsToApply(offer.units, unitsRemaining(r));
    // Stock is only taken on acceptance (spec 7.D): conditional decrement re-checks it now.
    const { modifiedCount } = await InventoryItem.updateOne(
      { bloodBankId: offer.bloodBankId, bloodGroup: offer.bloodGroup, units: { $gte: applied } },
      { $inc: { units: -applied }, updatedAt: now },
    );
    if (modifiedCount === 0) {
      throw new HttpError(409, `${bankName} no longer has ${applied} unit${applied === 1 ? "" : "s"} of ${show(offer.bloodGroup)} in stock.`);
    }
    await SupplyOffer.updateOne({ _id: offer._id }, { status: "ACCEPTED", units: applied });
    const result = await addUnitsToRequest(ctx, r, applied, now);
    await notify(
      [String(offer.bloodBankId)],
      {
        type: "SUPPLY_OFFER",
        title: "Supply offer accepted",
        body: `${applied} unit${applied === 1 ? "" : "s"} of ${show(offer.bloodGroup)} for ${r.hospitalName}. Your inventory has been updated.`,
        link: "/bloodbank",
      },
      ctx,
    );
    return { status: "ACCEPTED" as const, unitsApplied: applied, requestStatus: result.status };
  });
}

// ---------------------------------------------------------------------------
// Walk-in donations (spec 8: search donor by email/phone)
// ---------------------------------------------------------------------------

export async function findDonorForWalkIn(query: string, now = new Date()): Promise<WalkInDonor | null> {
  const q = query.trim().toLowerCase();
  const phone = q.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  const user = await User.findOne({ role: "DONOR", $or: [{ email: q }, { phone }] }).lean();
  if (!user?.donorProfile) return null;
  const e = walkInEligibility({ status: user.status, ...user.donorProfile, lastDonationAt: user.donorProfile.lastDonationAt ?? null }, now);
  return {
    donorId: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    bloodGroup: user.donorProfile.bloodGroup,
    verified: user.donorProfile.bloodGroupVerified,
    eligible: e.eligible,
    reasons: e.reasons,
  };
}

/** Owner decisions: blocked if ineligible; adds the units to the bank's stock for the donor's group. */
export async function recordWalkInDonation(bank: CurrentUser, donorId: string, units: number, now = new Date()) {
  return transaction(async (ctx) => {
    const donor = await User.findById(donorId).lean().catch(() => null);
    if (!donor || donor.role !== "DONOR" || !donor.donorProfile) throw new HttpError(404, "Donor not found.");
    const e = walkInEligibility({ status: donor.status, ...donor.donorProfile, lastDonationAt: donor.donorProfile.lastDonationAt ?? null }, now);
    if (!e.eligible) throw new HttpError(409, e.reason ?? "This donor isn't eligible to donate right now.");

    const orgName = bank.institution?.orgName ?? bank.name;
    const group = donor.donorProfile.bloodGroup;
    await DonationRecord.create([{ donorId, recordedById: bank.id, units, donatedAt: now, location: orgName }]);
    await User.updateOne({ _id: donorId }, { "donorProfile.lastDonationAt": now, "donorProfile.bloodGroupVerified": true });
    await InventoryItem.updateOne(
      { bloodBankId: bank.id, bloodGroup: group },
      { $inc: { units }, $set: { updatedAt: now }, $setOnInsert: { lowStockThreshold: DEFAULT_THRESHOLD } },
      { upsert: true },
    );
    await notify(
      [donorId],
      {
        type: "REQUEST_UPDATE",
        title: "Thank you for donating!",
        body: `Your donation at ${orgName} has been recorded. Your blood group is now verified.`,
        link: "/donor/history",
      },
      ctx,
    );
    return { bloodGroup: group, units };
  });
}

// ---------------------------------------------------------------------------
// Camps (spec 8: create / list; shown on nearby donors' home page)
// ---------------------------------------------------------------------------

export async function listCamps(bankId: string, now = new Date()): Promise<CampRow[]> {
  const camps = await DonationCamp.find({ bloodBankId: bankId }).sort({ startsAt: 1 }).lean();
  return camps.map((c) => ({
    ended: c.endsAt.getTime() <= now.getTime(),
    id: String(c._id),
    title: c.title,
    description: c.description,
    address: c.address,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
  }));
}

export async function createCamp(
  bankId: string,
  input: { title: string; description: string; startsAt: string; endsAt: string; address: string; lat: number; lng: number },
  now = new Date(),
) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt.getTime() <= startsAt.getTime()) throw new HttpError(400, "The camp must end after it starts.");
  if (endsAt.getTime() <= now.getTime()) throw new HttpError(400, "The camp must end in the future.");
  const camp = await DonationCamp.create({ bloodBankId: bankId, ...input, startsAt, endsAt });
  return { id: String(camp._id) };
}
