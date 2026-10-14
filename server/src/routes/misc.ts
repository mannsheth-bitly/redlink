import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { markReadSchema } from "@red-link/shared/validators";
import { me, requireUser } from "../auth.ts";
import { HttpError, parse } from "../http.ts";
import { Notification } from "../models.ts";
import { geocode } from "../services/geocode.ts";
import { runLazyMaintenance } from "../services/lifecycle.ts";
import { getPublicStats } from "../services/stats.ts";
import { getNotificationsFor } from "../services/views.ts";

export const miscRouter = Router();

/** Also runs lazy expiry + CRITICAL auto-escalation (spec 5.4 / 5.7 / Section 9). */
miscRouter.get("/notifications", requireUser(undefined, { allowInactive: true }), async (req, res) => {
  await runLazyMaintenance();
  res.json(await getNotificationsFor(me(req).id));
});

/** Body: `{ ids: string[] }` or `{ ids: "all" }`; only the caller's own notifications. */
miscRouter.post("/notifications/read", requireUser(undefined, { allowInactive: true }), async (req, res) => {
  const { ids } = parse(markReadSchema, req.body);
  const validIds = ids === "all" ? [] : ids.filter((id) => isValidObjectId(id));
  const filter = { userId: me(req).id, readAt: null, ...(ids === "all" ? {} : { _id: { $in: validIds } }) };
  const { modifiedCount } = await Notification.updateMany(filter, { readAt: new Date() });
  res.json({ updated: modifiedCount });
});

miscRouter.get("/public/stats", async (_req, res) => {
  res.json(await getPublicStats());
});

/** Address search (OpenStreetMap Nominatim). Open to signup visitors, so rate-limited server-side. */
miscRouter.get("/geocode", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 3) throw new HttpError(400, "Type at least 3 characters.");
  if (q.length > 200) throw new HttpError(400, "That address is too long.");
  res.json({ results: await geocode(q) });
});
