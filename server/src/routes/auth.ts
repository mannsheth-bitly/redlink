import { Router } from "express";
import { isInstitutionRole, isRole, ROLE_HOME } from "@red-link/shared/domain/constants";
import { loginSchema, signupSchema } from "@red-link/shared/validators";
import { endSession, hashPassword, startSession, toCurrentUser, verifyPassword } from "../auth.ts";
import { env } from "../env.ts";
import { AttemptLimiter, HttpError, parse } from "../http.ts";
import { User } from "../models.ts";

export const authRouter = Router();

// Public-site protection: 10 wrong passwords per email + IP in 15 minutes; in production also
// 20 sign-ups per IP per hour (off locally, where tests create many accounts).
const failedLogins = new AttemptLimiter(10, 15 * 60_000);
const signups = new AttemptLimiter(20, 60 * 60_000);

authRouter.post("/signup", async (req, res) => {
  if (env.isProduction) signups.check(req.ip ?? "", "Too many sign-ups from this network.");
  const input = parse(signupSchema, req.body);
  if (env.isProduction) signups.record(req.ip ?? "");
  if (await User.exists({ email: input.email })) throw new HttpError(409, "An account with this email already exists.");
  const institution = isInstitutionRole(input.role);
  const user = await User.create({
    role: input.role,
    // Spec 7.C: institutions wait for admin approval.
    status: institution ? "PENDING_VERIFICATION" : "ACTIVE",
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    lat: input.location.lat,
    lng: input.location.lng,
    address: input.location.address,
    city: input.location.city,
    pincode: input.location.pincode,
    donorProfile:
      input.role === "DONOR"
        ? {
            bloodGroup: input.bloodGroup,
            dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
            gender: input.gender,
            weightKg: input.weightKg,
            lastDonationAt: input.lastDonationAt ? new Date(`${input.lastDonationAt}T00:00:00.000Z`) : null,
          }
        : null,
    institution:
      input.role === "HOSPITAL" || input.role === "EMERGENCY" || input.role === "BLOOD_BANK"
        ? { type: input.role, orgName: input.orgName, licenseNumber: input.licenseNumber }
        : null,
  });
  await startSession(res, String(user._id), input.role);
  res.status(201).json({ redirectTo: ROLE_HOME[input.role] });
});

authRouter.post("/login", async (req, res) => {
  const input = parse(loginSchema, req.body);
  const key = `${req.ip ?? ""}|${input.email}`;
  failedLogins.check(key, "Too many wrong passwords.");
  const user = await User.findOne({ email: input.email }, { role: 1, status: 1, passwordHash: 1 }).lean();
  // Same message for unknown email and wrong password, so emails can't be probed.
  if (!user || !(await verifyPassword(input.password, user.passwordHash)) || !isRole(user.role)) {
    failedLogins.record(key);
    throw new HttpError(401, "Incorrect email or password.");
  }
  failedLogins.clear(key);
  if (user.status === "SUSPENDED") throw new HttpError(403, "This account has been suspended. Contact the Red Link admin.");
  await startSession(res, String(user._id), user.role);
  res.json({ redirectTo: ROLE_HOME[user.role] });
});

authRouter.post("/logout", (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

/**
 * The logged-in user, or `{ user: null }` when logged out. Being logged out isn't an error,
 * so this returns 200 either way (no red 401s in the browser console on public pages).
 */
authRouter.get("/me", async (req, res) => {
  const fresh = req.user ? await User.findById(req.user.id).lean() : null;
  res.json({ user: fresh ? toCurrentUser(fresh) : null });
});
