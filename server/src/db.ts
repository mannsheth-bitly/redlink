import mongoose from "mongoose";

// Every query inside `transaction()` automatically joins the transaction's session.
mongoose.set("transactionAsyncLocalStorage", true);
mongoose.set("strictQuery", true);

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

/** Work that must only happen once the transaction has committed (e.g. sending email). */
export interface TxContext {
  afterCommit: Array<() => Promise<void> | void>;
}

/**
 * Runs `fn` in a MongoDB transaction (requires a replica set; see README). MongoDB retries
 * the whole function on transient conflicts, e.g. two staff clicking at once; side effects
 * are queued on `ctx.afterCommit` and run only after a successful commit.
 */
export async function transaction<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T> {
  let result: T | undefined;
  let ctx: TxContext = { afterCommit: [] };
  await mongoose.connection.transaction(async () => {
    ctx = { afterCommit: [] }; // reset on each retry
    result = await fn(ctx);
  });
  for (const job of ctx.afterCommit) {
    try {
      await job();
    } catch (error) {
      console.error("[afterCommit]", error);
    }
  }
  return result as T;
}
