import { ProfileForm } from "@/components/donor/profile-form";
import { VerifiedBadge } from "@/components/shared/badges";
import { Card, CardContent } from "@/components/ui/card";
import { toDateInputValue } from "@red-link/shared/format";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";

export default function DonorProfilePage() {
  usePageTitle("Profile");
  const user = useUser();
  const p = user.donorProfile!;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Your profile</h1>
        {p.bloodGroupVerified ? <VerifiedBadge /> : null}
      </div>
      <Card>
        <CardContent>
          <ProfileForm
            // Re-initialise the form whenever the saved profile changes.
            key={JSON.stringify(user)}
            verified={p.bloodGroupVerified}
            initialLocation={user.lat !== null && user.lng !== null ? { lat: user.lat, lng: user.lng } : null}
            initial={{
              name: user.name,
              email: user.email,
              phone: user.phone,
              address: user.address ?? "",
              city: user.city ?? "",
              pincode: user.pincode ?? "",
              bloodGroup: p.bloodGroup,
              dateOfBirth: toDateInputValue(p.dateOfBirth),
              gender: p.gender,
              weightKg: String(p.weightKg),
              lastDonationAt: toDateInputValue(p.lastDonationAt),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
