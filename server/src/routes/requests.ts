import { Router } from "express";
import {
  cancelRequestSchema,
  createRequestSchema,
  receiverRequestSchema,
  recordDonationSchema,
} from "@red-link/shared/validators";
import { me, requireUser } from "../auth.ts";
import { HttpError, idParam, parse } from "../http.ts";
import { cancelRequest, expandRequestRadius, runLazyMaintenance } from "../services/lifecycle.ts";
import { createReceiverRequest, createRequest, recordDonation } from "../services/requests.ts";
import {
  getDonationsRecordedBy,
  getDonorRequestDetail,
  getHospitalPatientRequests,
  getOwnRequests,
  getRequestView,
  getVerifiedHospitals,
} from "../services/views.ts";

export const requestsRouter = Router();
const requesters = requireUser(["HOSPITAL", "EMERGENCY", "RECEIVER"]);

/** Create a request and broadcast it to matched donors (spec 7.A; 7.B step 5 for receivers). */
requestsRouter.post("/requests", requesters, async (req, res) => {
  const user = me(req);
  const result =
    user.role === "RECEIVER"
      ? await createReceiverRequest(user, parse(receiverRequestSchema, req.body))
      : await createRequest(user, parse(createRequestSchema, req.body));
  res.status(201).json(result);
});

/** The caller's own requests (+ for hospitals, receiver requests that chose them). */
requestsRouter.get("/requests", requesters, async (req, res) => {
  await runLazyMaintenance();
  const user = me(req);
  const [own, assigned] = await Promise.all([
    getOwnRequests(user.id),
    user.role === "HOSPITAL" ? getHospitalPatientRequests(user.id) : Promise.resolve([]),
  ]);
  res.json({ requests: own, patientRequests: assigned });
});

/** Role-aware detail: requester/chosen hospital get the ranked list; a matched donor gets the donor view. */
requestsRouter.get("/requests/:id", requireUser(), async (req, res) => {
  const id = idParam(req);
  await runLazyMaintenance();
  const user = me(req);
  const view = user.role === "DONOR" ? await getDonorRequestDetail(user.id, id) : await getRequestView(user, id);
  if (!view) throw new HttpError(404, "Request not found.");
  res.json(view);
});

requestsRouter.post("/requests/:id/donations", requireUser(["HOSPITAL", "EMERGENCY"]), async (req, res) => {
  const { donorId, units } = parse(recordDonationSchema, req.body);
  res.status(201).json(await recordDonation(me(req), idParam(req), donorId, units));
});

requestsRouter.post("/requests/:id/expand", requesters, async (req, res) => {
  res.json(await expandRequestRadius(me(req), idParam(req)));
});

requestsRouter.post("/requests/:id/cancel", requesters, async (req, res) => {
  const { reason } = parse(cancelRequestSchema, req.body);
  res.json(await cancelRequest(me(req), idParam(req), reason || null));
});

/** Addition: donations recorded by this hospital / emergency service / blood bank. */
requestsRouter.get("/donations", requireUser(["HOSPITAL", "EMERGENCY", "BLOOD_BANK"]), async (req, res) => {
  res.json({ donations: await getDonationsRecordedBy(me(req).id) });
});

/** Addition: verified hospitals a receiver can choose for their request. */
requestsRouter.get("/hospitals", requireUser(["RECEIVER"]), async (req, res) => {
  res.json({ hospitals: await getVerifiedHospitals(me(req)) });
});
