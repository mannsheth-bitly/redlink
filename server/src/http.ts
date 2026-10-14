import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import type { z } from "zod";

/** An error with an HTTP status; the error handler turns it into `{ error }` (spec Section 9). */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** First zod issue as a readable message, e.g. "phone: Enter a valid 10-digit Indian mobile number". */
export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Validates input with a zod schema or throws a 400. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw new HttpError(400, zodMessage(result.error));
  return result.data;
}

/** Route param that must be a MongoDB id; anything else is a 404 rather than a crash. */
export function idParam(req: Request, name = "id"): string {
  const value = req.params[name];
  if (typeof value !== "string" || !isValidObjectId(value)) throw new HttpError(404, "Not found.");
  return value;
}

/**
 * Small in-memory attempt counter (one server process, so no shared store is needed).
 * Used to slow down password guessing and sign-up spam on the public site.
 */
export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string, now: number) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Throws 429 if `key` has used up its attempts. */
  check(key: string, message: string, now = Date.now()) {
    const list = this.recent(key, now);
    if (list.length >= this.max) {
      const waitMin = Math.max(1, Math.ceil((this.windowMs - (now - list[0])) / 60_000));
      throw new HttpError(429, `${message} Try again in ${waitMin} minute${waitMin === 1 ? "" : "s"}.`);
    }
  }

  record(key: string, now = Date.now()) {
    this.hits.set(key, [...this.recent(key, now), now]);
  }

  clear(key: string) {
    this.hits.delete(key);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }
  // Duplicate key (e.g. email already registered in a race).
  if (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 11000) {
    res.status(409).json({ error: "That already exists." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
