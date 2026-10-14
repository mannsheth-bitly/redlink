import { Card, CardContent } from "@/components/ui/card";
import {
  DONATION_COOLDOWN_DAYS,
  MAX_DONOR_AGE,
  MIN_DONOR_AGE,
  MIN_DONOR_WEIGHT_KG,
} from "@red-link/shared/domain/constants";
import { usePageTitle } from "@/lib/page-title";

export default function AboutPage() {
  usePageTitle("About");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">About Red Link</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Red Link is a blood donation platform that connects willing donors with patients, hospitals, emergency
        services and blood banks, and does the matching automatically.
      </p>

      <h2 className="mt-10 text-xl font-bold">How donors are matched</h2>
      <Card className="mt-4">
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Blood group compatibility</strong> using red-cell transfusion rules (for example, an A+ patient
              can receive from O−, O+, A− and A+).
            </li>
            <li>
              <strong>Eligibility:</strong> aged {MIN_DONOR_AGE}–{MAX_DONOR_AGE}, at least {MIN_DONOR_WEIGHT_KG} kg,
              marked available, and at least {DONATION_COOLDOWN_DAYS} days since the last donation.
            </li>
            <li>
              <strong>Distance</strong> from the hospital, within a radius that depends on urgency (10 km normal,
              25 km urgent, 50 km critical).
            </li>
            <li>
              <strong>Ranking:</strong> exact blood group first, then closer donors, then donors whose blood group
              has been verified at a previous donation.
            </li>
          </ul>
        </CardContent>
      </Card>

      <h2 className="mt-10 text-xl font-bold">Privacy</h2>
      <p className="mt-2 text-muted-foreground">
        Patients searching for donors only see a first name and last initial, blood group and an approximate
        distance. A donor&apos;s phone number is shared only after the donor accepts. Exact locations are never
        shown to other users.
      </p>

      <h2 className="mt-10 text-xl font-bold">Verified institutions</h2>
      <p className="mt-2 text-muted-foreground">
        Hospitals, emergency services and blood banks are verified by an admin before they can broadcast
        requests or record donations. A donor&apos;s self-reported blood group earns a &quot;Verified&quot; badge
        once a hospital or blood bank records a donation from them.
      </p>
    </div>
  );
}
