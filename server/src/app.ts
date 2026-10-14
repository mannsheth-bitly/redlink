import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import mongoose from "mongoose";
import { attachUser } from "./auth.ts";
import { env } from "./env.ts";
import { errorHandler, HttpError } from "./http.ts";
import { adminRouter } from "./routes/admin.ts";
import { authRouter } from "./routes/auth.ts";
import { bloodBankRouter } from "./routes/bloodbank.ts";
import { donorRouter } from "./routes/donor.ts";
import { miscRouter } from "./routes/misc.ts";
import { peopleRouter } from "./routes/people.ts";
import { requestsRouter } from "./routes/requests.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(here, "../../client/dist");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Hosts like Render sit behind one proxy; trust it so req.ip is the visitor's address.
  if (env.isProduction) app.set("trust proxy", 1);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  // Health check for hosting (Render pings this); also confirms the database is reachable.
  app.get("/api/health", (_req, res) => {
    const up = mongoose.connection.readyState === 1;
    res.status(up ? 200 : 503).json({ ok: up });
  });
  app.use("/api", attachUser);

  app.use("/api/auth", authRouter);
  app.use("/api", donorRouter, requestsRouter, peopleRouter, bloodBankRouter, adminRouter, miscRouter);
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found.")));

  // Production / demo: serve the built React app from the same port (npm run build && npm start).
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
