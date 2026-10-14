import { Router } from "express";
import { contactRequestSchema, donorSearchSchema, respondSchema } from "@red-link/shared/validators";
import { me, requireUser } from "../auth.ts";
import { idParam, parse } from "../http.ts";
import { createContactRequest, listContactRequests, respondToContactRequest } from "../services/contacts.ts";
import { searchDonors } from "../services/search.ts";

export const peopleRouter = Router();

/** GET /api/donors/search?bloodGroup&lat&lng&radiusKm&verifiedOnly (masked; spec 4 / 7.B). */
peopleRouter.get("/donors/search", requireUser(["RECEIVER", "HOSPITAL", "EMERGENCY", "ADMIN"]), async (req, res) => {
  res.json({ results: await searchDonors(parse(donorSearchSchema, req.query), me(req).id) });
});

peopleRouter.post("/contact-requests", requireUser(["RECEIVER"]), async (req, res) => {
  const { donorId, message } = parse(contactRequestSchema, req.body);
  res.status(201).json(await createContactRequest(me(req), donorId, message));
});

peopleRouter.get("/contact-requests", requireUser(["RECEIVER", "DONOR"]), async (req, res) => {
  res.json({ contactRequests: await listContactRequests(me(req)) });
});

peopleRouter.post("/contact-requests/:id/respond", requireUser(["DONOR"]), async (req, res) => {
  const { action } = parse(respondSchema, req.body);
  res.json(await respondToContactRequest(me(req), idParam(req), action));
});
