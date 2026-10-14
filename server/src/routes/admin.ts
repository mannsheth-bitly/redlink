import { Router } from "express";
import {
  adminRequestsQuerySchema,
  adminUserActionSchema,
  adminUsersQuerySchema,
  createFlagSchema,
  flagsQuerySchema,
  reviewFlagSchema,
  verificationDecisionSchema,
} from "@red-link/shared/validators";
import { me, requireUser } from "../auth.ts";
import { idParam, parse } from "../http.ts";
import {
  changeUserStatus,
  decideVerification,
  getAdminStats,
  listAllRequests,
  listFlags,
  listUsers,
  listVerifications,
  reviewFlag,
} from "../services/admin.ts";
import { createFlag } from "../services/flags.ts";
import { runLazyMaintenance } from "../services/lifecycle.ts";

export const adminRouter = Router();
const admin = requireUser(["ADMIN"]);

adminRouter.get("/admin/stats", admin, async (_req, res) => {
  await runLazyMaintenance();
  res.json(await getAdminStats());
});

adminRouter.get("/admin/verifications", admin, async (_req, res) => {
  res.json(await listVerifications());
});

/** Body: `{ action: "APPROVE" | "REJECT", note? }` (a note is required to reject). */
adminRouter.post("/admin/verifications/:userId", admin, async (req, res) => {
  const { action, note } = parse(verificationDecisionSchema, req.body);
  res.json(await decideVerification(me(req), idParam(req, "userId"), action, note || null));
});

adminRouter.get("/admin/users", admin, async (req, res) => {
  res.json(await listUsers(parse(adminUsersQuerySchema, req.query)));
});

/** Body: `{ action: "SUSPEND" | "REACTIVATE" }`. */
adminRouter.patch("/admin/users/:id", admin, async (req, res) => {
  const { action } = parse(adminUserActionSchema, req.body);
  res.json(await changeUserStatus(me(req), idParam(req), action));
});

adminRouter.get("/admin/flags", admin, async (req, res) => {
  const { status } = parse(flagsQuerySchema, req.query);
  res.json({ flags: await listFlags(status) });
});

/** Body: `{ flagId, action: "RESOLVE" | "DISMISS" | "SUSPEND_AND_RESOLVE", note? }`. */
adminRouter.patch("/admin/flags", admin, async (req, res) => {
  const { flagId, action, note } = parse(reviewFlagSchema, req.body);
  res.json(await reviewFlag(me(req), flagId, action, note || null));
});

/** Addition (owner decision): read-only list of every request. */
adminRouter.get("/admin/requests", admin, async (req, res) => {
  await runLazyMaintenance();
  const { status } = parse(adminRequestsQuerySchema, req.query);
  res.json({ requests: await listAllRequests(status) });
});

/** Spec 4: every role except admin can report a user or request. */
adminRouter.post("/flags", requireUser(["DONOR", "RECEIVER", "HOSPITAL", "EMERGENCY", "BLOOD_BANK"]), async (req, res) => {
  res.status(201).json(await createFlag(me(req), parse(createFlagSchema, req.body)));
});
