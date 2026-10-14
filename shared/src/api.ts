/**
 * JSON shapes returned by the Express API. The server's functions are annotated with these
 * types and the React client consumes them, so both sides stay in sync. Dates are ISO strings.
 */
import type { BloodGroup, Role } from "./domain/constants.ts";

export type RequesterBadge = "INDIVIDUAL" | "VERIFIED_INSTITUTION" | null;

export interface ApiUser {
  id: string;
  role: Role;
  status: string;
  name: string;
  email: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  donorProfile: {
    bloodGroup: string;
    dateOfBirth: string;
    gender: string;
    weightKg: number;
    lastDonationAt: string | null;
    isAvailable: boolean;
    bloodGroupVerified: boolean;
  } | null;
  institution: {
    type: string;
    orgName: string;
    licenseNumber: string;
    verifiedAt: string | null;
    rejectionNote: string | null;
  } | null;
}

export interface PublicStats {
  registeredDonors: number;
  donorsReadyNow: number;
  requestsFulfilled: number;
  unitsDonated: number;
}

// ---- Donor ----
export interface DonorFeedItem {
  matchId: string;
  requestId: string;
  matchStatus: string;
  bloodGroup: string;
  urgency: string;
  unitsStillNeeded: number;
  hospitalName: string;
  distanceKm: number;
  distanceLabel: string;
  neededBy: string;
  createdAt: string;
  badge: RequesterBadge;
}

export interface DonorRequestDetail {
  matchId: string;
  matchStatus: string;
  respondedAt: string | null;
  distanceLabel: string;
  request: {
    id: string;
    bloodGroup: string;
    urgency: string;
    status: string;
    unitsNeeded: number;
    unitsFulfilled: number;
    patientNote: string | null;
    hospitalName: string;
    /** Only sent once the donor has accepted. */
    hospitalAddress: string | null;
    neededBy: string;
    createdAt: string;
    isOpen: boolean;
    badge: RequesterBadge;
  };
}

export interface DonationHistoryItem {
  id: string;
  donatedAt: string;
  units: number;
  location: string;
  recordedBy: string;
  requestUrgency: string | null;
}

export interface NearbyCamp {
  id: string;
  title: string;
  description: string;
  address: string;
  startsAt: string;
  endsAt: string;
  organiser: string;
  distanceLabel: string;
}

// ---- Requests ----
export interface RequestSummary {
  id: string;
  bloodGroup: string;
  urgency: string;
  status: string;
  isOpen: boolean;
  unitsNeeded: number;
  unitsFulfilled: number;
  hospitalName: string;
  neededBy: string;
  createdAt: string;
  matchedCount: number;
  acceptedCount: number;
  donatedCount: number;
}

export interface RequestMatchRow {
  id: string;
  status: string;
  score: number;
  distanceLabel: string;
  bloodGroup: string;
  verified: boolean;
  respondedAt: string | null;
  displayName: string;
  phone: string | null;
  donorId: string | null;
}

export interface SupplyOfferRow {
  id: string;
  bankName: string;
  bloodGroup: string;
  units: number;
  status: string;
  createdAt: string;
}

export interface RequestView {
  request: {
    id: string;
    bloodGroup: string;
    urgency: string;
    status: string;
    isOpen: boolean;
    unitsNeeded: number;
    unitsFulfilled: number;
    maxUnitsPerDonation: number;
    patientNote: string | null;
    hospitalName: string;
    hospitalAddress: string | null;
    radiusKm: number;
    neededBy: string;
    createdAt: string;
    fulfilledAt: string | null;
    raisedBy: string | null;
    lastEscalatedAt: string | null;
    escalationDueAt: string | null;
  };
  viewer: {
    canRecord: boolean;
    isRecordingHospital: boolean;
    canExpand: boolean;
    nextRadiusKm: number | null;
    canCancel: boolean;
    canRespondOffers: boolean;
    /** Report accepted / donated donors (requester or chosen hospital). */
    canReportDonors: boolean;
    /** Report the request itself (the chosen hospital on a receiver's request). */
    canReportRequest: boolean;
    /** Read-only admin view. */
    isAdmin: boolean;
  };
  /** Who raised the request and which hospital records it. Admin view only. */
  admin: { createdBy: { name: string; role: string; email: string }; recordingHospital: string | null } | null;
  supplyOffers: SupplyOfferRow[];
  matches: RequestMatchRow[];
  counts: { accepted: number; notified: number; declined: number; donated: number };
}

export interface DonationRow {
  id: string;
  donatedAt: string;
  donorName: string;
  bloodGroup: string;
  units: number;
  location: string;
  requestId: string | null;
}

export interface HospitalOption {
  id: string;
  name: string;
  address: string;
  distanceKm: number | null;
  distanceLabel: string | null;
}

// ---- Notifications ----
export interface NotificationItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  urgent: NotificationItem[];
}

// ---- Search & contacts ----
export interface DonorSearchResult {
  donorId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  verified: boolean;
  distanceLabel: string;
  approxLocation: { lat: number; lng: number };
  contactStatus: string | null;
}

export interface ContactRequestItem {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  respondedAt: string | null;
  otherName: string;
  otherPhone: string | null;
  bloodGroup: string | null;
  verified: boolean;
}

// ---- Blood bank ----
export interface InventoryTile {
  bloodGroup: BloodGroup;
  units: number;
  lowStockThreshold: number;
  low: boolean;
}

export interface SupplyableRequest {
  id: string;
  bloodGroup: string;
  urgency: string;
  hospitalName: string;
  unitsNeeded: number;
  unitsFulfilled: number;
  stillNeeded: number;
  neededBy: string;
  distanceKm: number;
  distanceLabel: string;
  isIndividual: boolean;
  options: { bloodGroup: BloodGroup; units: number; maxUnits: number }[];
  myOffer: { id: string; status: string; units: number; bloodGroup: string } | null;
}

export interface CampRow {
  id: string;
  title: string;
  description: string;
  address: string;
  startsAt: string;
  endsAt: string;
  /** Worked out on the server at request time. */
  ended: boolean;
}

export interface WalkInDonor {
  donorId: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  verified: boolean;
  eligible: boolean;
  reasons: string[];
}

// ---- Admin ----
export interface AdminStats {
  totals: {
    donors: number;
    availableNow: number;
    openRequests: number;
    fulfilledThisMonth: number;
    /** Fulfilled ÷ closed requests, in %; null when nothing has closed. */
    fulfilmentRate: number | null;
    closedRequests: number;
    avgFirstAcceptanceMinutes: number | null;
  };
  byBloodGroup: { bloodGroup: BloodGroup; requests: number }[];
  last14Days: { day: string; created: number; fulfilled: number }[];
  pending: { verifications: number; openFlags: number };
}

export interface VerificationItem {
  id: string;
  role: string;
  status: string;
  orgName: string;
  licenseNumber: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  appliedAt: string;
  decidedAt: string | null;
  rejectionNote: string | null;
}

export interface AdminUserRow {
  id: string;
  role: Role;
  status: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  createdAt: string;
  orgName: string | null;
  bloodGroup: string | null;
  bloodGroupVerified: boolean;
  openFlags: number;
}

export interface FlagItem {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  reporter: { id: string; name: string; role: string };
  target: { id: string; name: string; role: string; status: string } | null;
  request: { id: string; bloodGroup: string; hospitalName: string; status: string } | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface AdminRequestRow extends RequestSummary {
  createdByName: string;
  createdByRole: string;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  pincode: string | null;
}
