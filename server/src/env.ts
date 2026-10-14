/** Environment configuration, read once at startup. See .env.example. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

export const env = {
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  isProduction: process.env.NODE_ENV === "production",
  /** Optional: email notifications via SMTP (e.g. Gmail + app password). Disabled when unset. */
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  },
  /** Base URL used for links inside emails. */
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  /** Contact address sent to OpenStreetMap Nominatim (their usage policy asks for one). */
  geocoderContact: process.env.GEOCODER_CONTACT ?? "",
};
