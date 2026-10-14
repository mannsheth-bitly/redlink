import { Router } from "express";
import {
  campSchema,
  inventoryPatchSchema,
  respondSchema,
  supplyOfferSchema,
  walkInSchema,
} from "@red-link/shared/validators";
import { me, requireUser } from "../auth.ts";
import { HttpError, idParam, parse } from "../http.ts";
import {
  createCamp,
  createSupplyOffer,
  findDonorForWalkIn,
  getInventory,
  getSupplyableRequests,
  listCamps,
  recordWalkInDonation,
  respondToSupplyOffer,
  updateInventory,
} from "../services/bloodbank.ts";
import { runLazyMaintenance } from "../services/lifecycle.ts";

export const bloodBankRouter = Router();
const bankOnly = requireUser(["BLOOD_BANK"]);

bloodBankRouter.get("/bloodbank/inventory", bankOnly, async (req, res) => {
  res.json({ inventory: await getInventory(me(req).id) });
});

/** Body: { bloodGroup, delta? | units?, lowStockThreshold? } */
bloodBankRouter.patch("/bloodbank/inventory", bankOnly, async (req, res) => {
  res.json({ inventory: await updateInventory(me(req).id, parse(inventoryPatchSchema, req.body)) });
});

bloodBankRouter.get("/bloodbank/open-requests", bankOnly, async (req, res) => {
  await runLazyMaintenance();
  res.json({ requests: await getSupplyableRequests(me(req)) });
});

bloodBankRouter.get("/bloodbank/camps", bankOnly, async (req, res) => {
  res.json({ camps: await listCamps(me(req).id) });
});

bloodBankRouter.post("/bloodbank/camps", bankOnly, async (req, res) => {
  res.status(201).json(await createCamp(me(req).id, parse(campSchema, req.body)));
});

/** Walk-in donation; adds the units to stock (owner decision). */
bloodBankRouter.post("/bloodbank/donations", bankOnly, async (req, res) => {
  const { donorId, units } = parse(walkInSchema, req.body);
  res.status(201).json(await recordWalkInDonation(me(req), donorId, units));
});

/** Addition: find a donor by exact email or phone for a walk-in. */
bloodBankRouter.get("/bloodbank/donors/lookup", bankOnly, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 5) throw new HttpError(400, "Enter the donor's full email or 10-digit phone number.");
  // "Not found" is a normal search result, so 200 with donor: null (no console error in the browser).
  res.json({ donor: await findDonorForWalkIn(q) });
});

bloodBankRouter.post("/supply-offers", bankOnly, async (req, res) => {
  const { requestId, bloodGroup, units } = parse(supplyOfferSchema, req.body);
  res.status(201).json(await createSupplyOffer(me(req), requestId, bloodGroup, units));
});

bloodBankRouter.post("/supply-offers/:id/respond", requireUser(["HOSPITAL", "EMERGENCY", "RECEIVER"]), async (req, res) => {
  const { action } = parse(respondSchema, req.body);
  res.json(await respondToSupplyOffer(me(req), idParam(req), action));
});
