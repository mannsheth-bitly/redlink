/**
 * MongoDB data model (Mongoose). Mirrors the spec's Section 6 entities. DonorProfile and
 * Institution are embedded in User (one-to-one, always read together); everything else is
 * its own collection. Enum-like fields hold the values from shared/src/domain/constants.ts.
 */
import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";
import {
  BLOOD_GROUPS,
  CONTACT_STATUSES,
  FLAG_STATUSES,
  GENDERS,
  INSTITUTION_ROLES,
  MATCH_STATUSES,
  NOTIFICATION_TYPES,
  OFFER_STATUSES,
  PRIORITIES,
  REQUEST_STATUSES,
  ROLES,
  URGENCIES,
  USER_STATUSES,
} from "@red-link/shared/domain/constants";

const { ObjectId } = Schema.Types;
const opts = { versionKey: false } as const;

// ---------------------------------------------------------------------------
// User (+ embedded DonorProfile / Institution)
// ---------------------------------------------------------------------------

const donorProfileSchema = new Schema(
  {
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    weightKg: { type: Number, required: true },
    lastDonationAt: { type: Date, default: null },
    isAvailable: { type: Boolean, default: true },
    bloodGroupVerified: { type: Boolean, default: false },
  },
  { _id: false },
);

const institutionSchema = new Schema(
  {
    type: { type: String, enum: INSTITUTION_ROLES, required: true },
    orgName: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    verifiedAt: { type: Date, default: null },
    verifiedById: { type: ObjectId, ref: "User", default: null },
    rejectionNote: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE" },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    address: { type: String, default: null },
    city: { type: String, default: null },
    pincode: { type: String, default: null },
    donorProfile: { type: donorProfileSchema, default: null },
    institution: { type: institutionSchema, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  opts,
);
// Matching prefilter: role + bounding box (spec 5.6).
userSchema.index({ role: 1, status: 1, lat: 1, lng: 1 });
userSchema.index({ phone: 1 });

// ---------------------------------------------------------------------------
// Requests and matching
// ---------------------------------------------------------------------------

const bloodRequestSchema = new Schema(
  {
    createdById: { type: ObjectId, ref: "User", required: true, index: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    unitsNeeded: { type: Number, required: true },
    unitsFulfilled: { type: Number, default: 0 },
    urgency: { type: String, enum: URGENCIES, required: true },
    status: { type: String, enum: REQUEST_STATUSES, default: "OPEN", index: true },
    patientNote: { type: String, default: null },
    hospitalName: { type: String, required: true },
    hospitalAddress: { type: String, default: null },
    /** For receiver-raised requests: the verified hospital that records donations. */
    recordingHospitalId: { type: ObjectId, ref: "User", default: null, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusKm: { type: Number, required: true },
    neededBy: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    fulfilledAt: { type: Date, default: null },
    lastEscalatedAt: { type: Date, default: null },
  },
  opts,
);

const requestMatchSchema = new Schema(
  {
    requestId: { type: ObjectId, ref: "BloodRequest", required: true },
    donorId: { type: ObjectId, ref: "User", required: true, index: true },
    distanceKm: { type: Number, required: true },
    score: { type: Number, required: true },
    status: { type: String, enum: MATCH_STATUSES, default: "NOTIFIED" },
    notifiedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  opts,
);
requestMatchSchema.index({ requestId: 1, donorId: 1 }, { unique: true });

const donationRecordSchema = new Schema(
  {
    donorId: { type: ObjectId, ref: "User", required: true, index: true },
    requestId: { type: ObjectId, ref: "BloodRequest", default: null },
    recordedById: { type: ObjectId, ref: "User", required: true, index: true },
    units: { type: Number, default: 1 },
    donatedAt: { type: Date, default: Date.now },
    location: { type: String, required: true },
  },
  opts,
);

// ---------------------------------------------------------------------------
// Contact, notifications, blood bank, flags
// ---------------------------------------------------------------------------

const contactRequestSchema = new Schema(
  {
    receiverId: { type: ObjectId, ref: "User", required: true, index: true },
    donorId: { type: ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true },
    status: { type: String, enum: CONTACT_STATUSES, default: "PENDING" },
    createdAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  opts,
);

const notificationSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    priority: { type: String, enum: PRIORITIES, default: "NORMAL" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: null },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  opts,
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

const inventoryItemSchema = new Schema(
  {
    bloodBankId: { type: ObjectId, ref: "User", required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    updatedAt: { type: Date, default: Date.now },
  },
  opts,
);
inventoryItemSchema.index({ bloodBankId: 1, bloodGroup: 1 }, { unique: true });

const supplyOfferSchema = new Schema(
  {
    requestId: { type: ObjectId, ref: "BloodRequest", required: true, index: true },
    bloodBankId: { type: ObjectId, ref: "User", required: true },
    /** Which compatible group's stock is offered (owner decision). */
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, required: true },
    status: { type: String, enum: OFFER_STATUSES, default: "PENDING" },
    createdAt: { type: Date, default: Date.now },
  },
  opts,
);

const donationCampSchema = new Schema(
  {
    bloodBankId: { type: ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  opts,
);

const flagSchema = new Schema(
  {
    reporterId: { type: ObjectId, ref: "User", required: true },
    targetUserId: { type: ObjectId, ref: "User", default: null },
    requestId: { type: ObjectId, ref: "BloodRequest", default: null },
    reason: { type: String, required: true },
    status: { type: String, enum: FLAG_STATUSES, default: "OPEN" },
    createdAt: { type: Date, default: Date.now },
    // Phase 6 additions: who reviewed the report, when, and the note sent to the reporter.
    resolvedAt: { type: Date, default: null },
    resolvedById: { type: ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, default: null },
  },
  opts,
);
flagSchema.index({ status: 1, createdAt: -1 });
flagSchema.index({ targetUserId: 1, status: 1 });

export const User = mongoose.model("User", userSchema);
export const BloodRequest = mongoose.model("BloodRequest", bloodRequestSchema);
export const RequestMatch = mongoose.model("RequestMatch", requestMatchSchema);
export const DonationRecord = mongoose.model("DonationRecord", donationRecordSchema);
export const ContactRequest = mongoose.model("ContactRequest", contactRequestSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema);
export const SupplyOffer = mongoose.model("SupplyOffer", supplyOfferSchema);
export const DonationCamp = mongoose.model("DonationCamp", donationCampSchema);
export const Flag = mongoose.model("Flag", flagSchema);

export const ALL_MODELS = [
  User,
  BloodRequest,
  RequestMatch,
  DonationRecord,
  ContactRequest,
  Notification,
  InventoryItem,
  SupplyOffer,
  DonationCamp,
  Flag,
];

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
const findRequestLean = (id: unknown) => BloodRequest.findById(id).lean();
/** A blood request as returned by `.lean()` queries. */
export type BloodRequestLean = NonNullable<Awaited<ReturnType<typeof findRequestLean>>>;

/** Typed status lists for `$in` filters. */
export const ACTIVE_STATUSES: ("OPEN" | "PARTIALLY_FULFILLED")[] = ["OPEN", "PARTIALLY_FULFILLED"];
export const PENDING_MATCH_STATUSES: ("NOTIFIED" | "ACCEPTED")[] = ["NOTIFIED", "ACCEPTED"];
