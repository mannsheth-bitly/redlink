/** Demo accounts created by `npm run db:seed` (spec Section 12). Shown only when NEXT_PUBLIC_DEMO_MODE=true. */
export const DEMO_PASSWORD = "demo1234";

export const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@redlink.test" },
  { label: "Hospital (verified)", email: "hospital@redlink.test" },
  { label: "Emergency (verified)", email: "emergency@redlink.test" },
  { label: "Blood Bank (verified)", email: "bloodbank@redlink.test" },
  { label: "Hospital (pending verification)", email: "newhospital@redlink.test" },
  { label: "Receiver", email: "receiver@redlink.test" },
  { label: "Donor (O−, available, eligible)", email: "donor@redlink.test" },
] as const;
