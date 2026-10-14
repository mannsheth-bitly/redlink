import { WalkInForm } from "@/components/bloodbank/walk-in-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/lib/page-title";
import { DonationsTable } from "@/pages/shared/donations";

/** Spec 8 /bloodbank/donations: record a walk-in donation, plus donations recorded by this bank. */
export default function WalkInsPage() {
  usePageTitle("Walk-in donations");
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Record a walk-in donation</CardTitle>
        </CardHeader>
        <CardContent>
          <WalkInForm />
        </CardContent>
      </Card>
      <DonationsTable base="/bloodbank" />
    </div>
  );
}
