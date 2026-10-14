import { z } from "zod";
import {
  BLOOD_GROUPS,
  FLAG_STATUSES,
  GENDERS,
  MAX_UNITS_PER_DONATION,
  MAX_UNITS_PER_REQUEST,
  RECEIVER_SEARCH_RADII_KM,
  REQUEST_STATUSES,
  ROLES,
  SIGNUP_ROLES,
  URGENCIES,
  USER_STATUSES,
} from "./domain/constants";

/** Indian mobile number: 10 digits starting 6–9, optional +91 / 0 prefix. Stored as the 10 digits. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(3, "Enter an address").max(200),
  city: z.string().trim().min(2, "Enter a city").max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
});

const baseSignup = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  location: locationSchema,
});

const isoDate = z.iso.date("Enter a valid date");

export const donorSignupSchema = baseSignup.extend({
  role: z.literal("DONOR"),
  bloodGroup: z.enum(BLOOD_GROUPS),
  dateOfBirth: isoDate,
  gender: z.enum(GENDERS),
  weightKg: z.number().min(20, "Enter your weight in kg").max(250),
  lastDonationAt: isoDate.optional(),
});

export const receiverSignupSchema = baseSignup.extend({
  role: z.literal("RECEIVER"),
});

export const institutionSignupSchema = baseSignup.extend({
  role: z.enum(["HOSPITAL", "EMERGENCY", "BLOOD_BANK"]),
  orgName: z.string().trim().min(2, "Enter the organisation name").max(120),
  licenseNumber: z.string().trim().min(3, "Enter the registration / licence number").max(60),
});

export const signupSchema = z.discriminatedUnion("role", [
  donorSignupSchema,
  receiverSignupSchema,
  institutionSignupSchema,
]);
export type SignupInput = z.infer<typeof signupSchema>;

export const signupRoleSchema = z.enum(SIGNUP_ROLES);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Phase 2
// ---------------------------------------------------------------------------

export const createRequestSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  unitsNeeded: z
    .number()
    .int("Units must be a whole number")
    .min(1, "At least 1 unit")
    .max(MAX_UNITS_PER_REQUEST, `At most ${MAX_UNITS_PER_REQUEST} units per request`),
  urgency: z.enum(URGENCIES),
  neededBy: z.iso.datetime({ offset: true, message: "Enter when the blood is needed by" }),
  patientNote: z.string().trim().max(200, "Keep the note under 200 characters").optional(),
  hospitalName: z.string().trim().min(2, "Enter where the donor should go").max(120),
  hospitalAddress: z.string().trim().min(3, "Enter the hospital address").max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const respondSchema = z.object({ action: z.enum(["ACCEPT", "DECLINE"]) });

export const recordDonationSchema = z.object({
  donorId: z.string().min(1),
  units: z.number().int().min(1).max(MAX_UNITS_PER_DONATION),
});

export const availabilitySchema = z.object({ isAvailable: z.boolean() });

export const donorProfileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: emailSchema,
  phone: phoneSchema,
  location: locationSchema,
  bloodGroup: z.enum(BLOOD_GROUPS),
  dateOfBirth: isoDate,
  gender: z.enum(GENDERS),
  weightKg: z.number().min(20, "Enter your weight in kg").max(250),
  lastDonationAt: isoDate.nullable(),
});
export type DonorProfileUpdateInput = z.infer<typeof donorProfileUpdateSchema>;

// ---------------------------------------------------------------------------
// Phase 3
// ---------------------------------------------------------------------------

/** Receiver-raised request: the receiver picks a verified hospital instead of typing a location (owner decision). */
export const receiverRequestSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  unitsNeeded: z
    .number()
    .int("Units must be a whole number")
    .min(1, "At least 1 unit")
    .max(MAX_UNITS_PER_REQUEST, `At most ${MAX_UNITS_PER_REQUEST} units per request`),
  urgency: z.enum(["NORMAL", "URGENT"]),
  neededBy: z.iso.datetime({ offset: true, message: "Enter when the blood is needed by" }),
  patientNote: z.string().trim().max(200, "Keep the note under 200 characters").optional(),
  hospitalId: z.string().min(1, "Choose the hospital where the patient is admitted"),
});
export type ReceiverRequestInput = z.infer<typeof receiverRequestSchema>;

const boolParam = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

export const donorSearchSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce
    .number()
    .refine((v) => (RECEIVER_SEARCH_RADII_KM as readonly number[]).includes(v), "Radius must be 5, 10, 25 or 50 km"),
  verifiedOnly: boolParam,
});
export type DonorSearchInput = z.infer<typeof donorSearchSchema>;

export const contactRequestSchema = z.object({
  donorId: z.string().min(1),
  message: z.string().trim().min(5, "Write a short message (at least 5 characters)").max(300, "Keep it under 300 characters"),
});

export const cancelRequestSchema = z.object({
  reason: z.string().trim().max(200, "Keep the reason under 200 characters").optional(),
});

// ---------------------------------------------------------------------------
// Phase 5 (blood bank)
// ---------------------------------------------------------------------------

export const inventoryPatchSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    delta: z.number().int().min(-100).max(100).optional(),
    units: z.number().int().min(0, "Stock can't be negative").max(10_000).optional(),
    lowStockThreshold: z.number().int().min(0).max(1000).optional(),
  })
  .refine((v) => v.delta !== undefined || v.units !== undefined || v.lowStockThreshold !== undefined, "Nothing to change");

export const supplyOfferSchema = z.object({
  requestId: z.string().min(1),
  bloodGroup: z.enum(BLOOD_GROUPS),
  units: z.number().int().min(1, "Offer at least 1 unit").max(MAX_UNITS_PER_REQUEST),
});

export const walkInSchema = z.object({
  donorId: z.string().min(1),
  units: z.number().int().min(1).max(MAX_UNITS_PER_DONATION),
});

export const campSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(100),
  description: z.string().trim().min(5, "Add a short description").max(500),
  startsAt: z.iso.datetime({ offset: true, message: "Enter the start time" }),
  endsAt: z.iso.datetime({ offset: true, message: "Enter the end time" }),
  address: z.string().trim().min(3, "Enter the venue address").max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const markReadSchema = z.object({
  ids: z.union([z.literal("all"), z.array(z.string().min(1)).min(1).max(200)]),
});

// ---------------------------------------------------------------------------
// Phase 6 (admin + reports)
// ---------------------------------------------------------------------------

const adminNote = z.string().trim().max(300, "Keep the note under 300 characters").optional();

export const verificationDecisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: adminNote,
});

export const adminUserActionSchema = z.object({ action: z.enum(["SUSPEND", "REACTIVATE"]) });

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined));

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: optionalEnum(ROLES),
  status: optionalEnum(USER_STATUSES),
});

export const adminRequestsQuerySchema = z.object({
  status: optionalEnum(["ACTIVE", ...REQUEST_STATUSES] as const),
});

export const flagsQuerySchema = z.object({ status: optionalEnum(FLAG_STATUSES) });

const flagReason = z
  .string()
  .trim()
  .min(10, "Describe the problem in at least 10 characters")
  .max(500, "Keep it under 500 characters");

/**
 * A report names what the reporter saw, not a raw user id, so people can only report
 * requests and people they have actually dealt with (checked on the server).
 */
export const createFlagSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("REQUEST"), requestId: z.string().min(1), reason: flagReason }),
  z.object({ kind: z.literal("MATCH"), matchId: z.string().min(1), reason: flagReason }),
  z.object({ kind: z.literal("CONTACT"), contactRequestId: z.string().min(1), reason: flagReason }),
]);
export type CreateFlagInput = z.infer<typeof createFlagSchema>;

export const reviewFlagSchema = z.object({
  flagId: z.string().min(1),
  action: z.enum(["RESOLVE", "DISMISS", "SUSPEND_AND_RESOLVE"]),
  note: adminNote,
});
