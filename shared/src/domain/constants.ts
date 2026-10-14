// Allowed values for every enum-like String column (SQLite has no enums).
// Validated with zod in src/lib/validators.ts.

export const ROLES = ["DONOR", "RECEIVER", "HOSPITAL", "EMERGENCY", "BLOOD_BANK", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that must be approved by an admin before they can use the app. */
export const INSTITUTION_ROLES = ["HOSPITAL", "EMERGENCY", "BLOOD_BANK"] as const;
export type InstitutionRole = (typeof INSTITUTION_ROLES)[number];

/** Roles a visitor can pick on the signup page (admins are created by the seed only). */
export const SIGNUP_ROLES = ["DONOR", "RECEIVER", "HOSPITAL", "EMERGENCY", "BLOOD_BANK"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const USER_STATUSES = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const BLOOD_GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export const URGENCIES = ["NORMAL", "URGENT", "CRITICAL"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const REQUEST_STATUSES = [
  "OPEN",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const MATCH_STATUSES = ["NOTIFIED", "ACCEPTED", "DECLINED", "DONATED", "NO_LONGER_NEEDED"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const CONTACT_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "REQUEST_MATCH",
  "REQUEST_UPDATE",
  "CONTACT_REQUEST",
  "CONTACT_RESPONSE",
  "VERIFICATION",
  "SUPPLY_OFFER",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const PRIORITIES = ["NORMAL", "URGENT", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const OFFER_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const FLAG_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

// ---- Eligibility (spec 5.3) ----
export const DONATION_COOLDOWN_DAYS = 90;
export const MIN_DONOR_AGE = 18;
export const MAX_DONOR_AGE = 65;
export const MIN_DONOR_WEIGHT_KG = 50;

// ---- Search radius by urgency (spec 5.4) ----
export const INITIAL_RADIUS_KM: Record<Urgency, number> = {
  NORMAL: 10,
  URGENT: 25,
  CRITICAL: 50,
};
export const URGENT_EXPAND_STEP_KM = 25;
export const URGENT_MAX_RADIUS_KM = 75;
export const CRITICAL_ESCALATION_AFTER_MINUTES = 10;
export const CRITICAL_ESCALATION_MIN_ACCEPTED = 3;
export const CRITICAL_ESCALATED_RADIUS_KM = 100;

// ---- Matching (spec 5.5) ----
export const MAX_DONORS_NOTIFIED_PER_STEP = 50;
export const SCORE_EXACT_GROUP = 30;
export const SCORE_PROXIMITY_MAX = 50;
export const SCORE_VERIFIED = 20;

// ---- Requests & donations ----
export const MAX_UNITS_PER_REQUEST = 20;
/** Staff choose 1 or 2 units per donor when recording a donation (owner decision). */
export const MAX_UNITS_PER_DONATION = 2;

// ---- Notifications (spec Section 10) ----
export const NOTIFICATION_POLL_MS = 10_000;
export const NOTIFICATION_POLL_URGENT_MS = 5_000;
/** Institution request pages refresh their ranked donor list this often. */
export const REQUEST_PAGE_POLL_MS = 10_000;

/** Default map view: Vidyavihar / Ghatkopar, Mumbai (spec Section 12). */
export const DEFAULT_MAP_CENTER = { lat: 19.07, lng: 72.9 } as const;

// ---- Receiver search (spec 7.B) ----
export const RECEIVER_SEARCH_RADII_KM = [5, 10, 25, 50] as const;

// ---- Blood bank supply (spec 7.D) ----
export const BLOOD_BANK_SUPPLY_RADIUS_KM = 50;

/** "Lives impacted" shown on donor history (spec 8): units × 3. */
export const LIVES_PER_UNIT = 3;

/** Dashboard each role lands on after login. */
export const ROLE_HOME: Record<Role, string> = {
  DONOR: "/donor",
  RECEIVER: "/receiver",
  HOSPITAL: "/hospital",
  EMERGENCY: "/emergency",
  BLOOD_BANK: "/bloodbank",
  ADMIN: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  DONOR: "Donor",
  RECEIVER: "Receiver / Patient",
  HOSPITAL: "Hospital",
  EMERGENCY: "Emergency Service",
  BLOOD_BANK: "Blood Bank",
  ADMIN: "Admin",
};

export function isInstitutionRole(role: string): role is InstitutionRole {
  return (INSTITUTION_ROLES as readonly string[]).includes(role);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
