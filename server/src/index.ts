import { createApp } from "./app.ts";
import { connectDb } from "./db.ts";
import { env } from "./env.ts";
import { ALL_MODELS } from "./models.ts";
import { emailChannel } from "./notify.ts";

async function main() {
  try {
    await connectDb(env.mongoUri);
  } catch (error) {
    console.error(
      "\nCould not connect to MongoDB at MONGODB_URI. Is the MongoDB service running, and is it a replica set? See README.\n",
      error,
    );
    process.exit(1);
  }
  await Promise.all(ALL_MODELS.map((m) => m.syncIndexes()));

  createApp().listen(env.port, () => {
    console.log(`Red Link API listening on http://localhost:${env.port}`);
    console.log(`Email notifications: ${emailChannel.enabled ? "ON" : "off (set SMTP_USER / SMTP_PASS in .env to enable)"}`);
  });
}

void main();
