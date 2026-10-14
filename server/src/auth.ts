import bcrypt from "bcryptjs";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { isValidObjectId } from "mongoose";
import type { ApiUser } from "@red-link/shared/api";
import { isRole, type Role } from "@red-link/shared/domain/constants";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";
import { User } from "./models.ts";

export const SESSION_COOKIE = "redlink_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const BCRYPT_ROUNDS = 10;
const secret = new TextEncoder().encode(env.jwtSecret);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
};

export async function startSession(res: Response, userId: string, role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS * 1000 });
}

export function endSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

async function verifySession(token: string | undefined): Promise<{ userId: string; role: Role } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const role = typeof payload.role === "string" ? payload.role : "";
    if (!payload.sub || !isValidObjectId(payload.sub) || !isRole(role)) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}

/** The logged-in user as sent to their own browser (never the password hash). */
export function toCurrentUser(u: {
  _id: { toString(): string };
  role: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  donorProfile?: {
    bloodGroup: string;
    dateOfBirth: Date;
    gender: string;
    weightKg: number;
    lastDonationAt?: Date | null;
    isAvailable: boolean;
    bloodGroupVerified: boolean;
  } | null;
  institution?: {
    type: string;
    orgName: string;
    licenseNumber: string;
    verifiedAt?: Date | null;
    rejectionNote?: string | null;
  } | null;
}): ApiUser {
  return {
    id: u._id.toString(),
    role: u.role as Role,
    status: u.status,
    name: u.name,
    email: u.email,
    phone: u.phone,
    lat: u.lat ?? null,
    lng: u.lng ?? null,
    address: u.address ?? null,
    city: u.city ?? null,
    pincode: u.pincode ?? null,
    donorProfile: u.donorProfile
      ? {
          bloodGroup: u.donorProfile.bloodGroup,
          dateOfBirth: u.donorProfile.dateOfBirth.toISOString(),
          gender: u.donorProfile.gender,
          weightKg: u.donorProfile.weightKg,
          lastDonationAt: u.donorProfile.lastDonationAt?.toISOString() ?? null,
          isAvailable: u.donorProfile.isAvailable,
          bloodGroupVerified: u.donorProfile.bloodGroupVerified,
        }
      : null,
    institution: u.institution
      ? {
          type: u.institution.type,
          orgName: u.institution.orgName,
          licenseNumber: u.institution.licenseNumber,
          verifiedAt: u.institution.verifiedAt?.toISOString() ?? null,
          rejectionNote: u.institution.rejectionNote ?? null,
        }
      : null,
  };
}
export type CurrentUser = ApiUser;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

/**
 * Loads the user for every request, fresh from the database, so admin decisions
 * (approval, suspension) take effect immediately. A token whose user no longer exists
 * or whose role changed is ignored and its cookie cleared.
 */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const session = await verifySession(req.cookies?.[SESSION_COOKIE]);
  if (session) {
    const doc = await User.findById(session.userId).lean();
    if (doc && doc.role === session.role) req.user = toCurrentUser(doc);
    else endSession(res);
  } else if (req.cookies?.[SESSION_COOKIE]) {
    endSession(res);
  }
  next();
}

/** Route guard: logged in, ACTIVE (unless allowInactive), and one of `roles` if given. */
export function requireUser(roles?: readonly Role[], options: { allowInactive?: boolean } = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new HttpError(401, "Please log in."));
    if (!options.allowInactive && user.status !== "ACTIVE") return next(new HttpError(403, "Your account is not active."));
    if (roles && !roles.includes(user.role)) return next(new HttpError(403, "You don't have permission to do that."));
    next();
  };
}

/** The authenticated user inside a handler guarded by requireUser(). */
export function me(req: Request): CurrentUser {
  if (!req.user) throw new HttpError(401, "Please log in.");
  return req.user;
}
