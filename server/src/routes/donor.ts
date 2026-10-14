import { Router } from "express";
import { LIVES_PER_UNIT } from "@red-link/shared/domain/constants";
import { availabilitySchema, donorProfileUpdateSchema, respondSchema } from "@red-link/shared/validators";
import { me, requireUser } from "../auth.ts";
import { idParam, parse } from "../http.ts";
import { runLazyMaintenance } from "../services/lifecycle.ts";
import { respondToMatch, setAvailability, updateDonorProfile } from "../services/requests.ts";
import { getDonorFeed, getDonorHistory, getNearbyCamps, NEARBY_CAMP_RADIUS_KM } from "../services/views.ts";

export const donorRouter = Router();
const donorOnly = requireUser(["DONOR"]);

donorRouter.patch("/donor/availability", donorOnly, async (req, res) => {
  const { isAvailable } = parse(availabilitySchema, req.body);
  await setAvailability(me(req).id, isAvailable);
  res.json({ isAvailable });
});

donorRouter.get("/donor/feed", donorOnly, async (req, res) => {
  await runLazyMaintenance();
  res.json({ feed: await getDonorFeed(me(req).id) });
});

donorRouter.get("/donor/history", donorOnly, async (req, res) => {
  const history = await getDonorHistory(me(req).id);
  const totalUnits = history.reduce((sum, h) => sum + h.units, 0);
  res.json({ history, totalUnits, livesImpacted: totalUnits * LIVES_PER_UNIT });
});

/** Addition to spec Section 9: nearby upcoming camps for the donor home page. */
donorRouter.get("/donor/camps", donorOnly, async (req, res) => {
  res.json({ camps: await getNearbyCamps(me(req)), radiusKm: NEARBY_CAMP_RADIUS_KM });
});

/** Addition to spec Section 9: edit the donor profile (owner decision: every field). */
donorRouter.patch("/donor/profile", donorOnly, async (req, res) => {
  await updateDonorProfile(me(req).id, parse(donorProfileUpdateSchema, req.body));
  res.json({ ok: true });
});

donorRouter.post("/matches/:id/respond", donorOnly, async (req, res) => {
  const { action } = parse(respondSchema, req.body);
  res.json(await respondToMatch(me(req).id, idParam(req), action));
});
