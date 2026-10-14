import { AvailabilityToggle } from "@/components/donor/availability-toggle";
import { CampsList } from "@/components/donor/camps-list";
import { EligibilityCard } from "@/components/donor/eligibility-card";
import { FeedList } from "@/components/donor/feed-list";
import { VerifiedBadge } from "@/components/shared/badges";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import type { DonorFeedItem, NearbyCamp } from "@red-link/shared/api";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { donorEligibility } from "@/lib/eligibility";
import { usePageTitle } from "@/lib/page-title";

/** Spec 8 /donor: availability, eligibility, matched requests (urgency then distance), nearby camps. */
export default function DonorHomePage() {
  usePageTitle("Donor home");
  const user = useUser();
  const feed = useApi<{ feed: DonorFeedItem[] }>("/api/donor/feed");
  const camps = useApi<{ camps: NearbyCamp[]; radiusKm: number }>("/api/donor/camps");
  const profile = user.donorProfile!;
  const eligibility = donorEligibility(user)!;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <BloodGroupPill group={profile.bloodGroup} className="px-3 py-1 text-lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {user.name.split(" ")[0]}</h1>
          {profile.bloodGroupVerified ? (
            <VerifiedBadge />
          ) : (
            <p className="text-xs text-muted-foreground">Blood group self-reported (verified after your first recorded donation)</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <AvailabilityToggle key={String(profile.isAvailable)} initial={profile.isAvailable} />
        <EligibilityCard eligibility={eligibility} />
      </div>

      <section aria-labelledby="feed-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="feed-heading" className="text-lg font-semibold">
            Requests matched to you
          </h2>
          {feed.data ? <span className="text-sm text-muted-foreground">{feed.data.feed.length} open</span> : null}
        </div>
        {feed.error ? (
          <PageError error={feed.error} onRetry={feed.reload} />
        ) : feed.data ? (
          <FeedList items={feed.data.feed} donorGroup={profile.bloodGroup} />
        ) : (
          <SectionLoading />
        )}
      </section>

      <section aria-labelledby="camps-heading" className="flex flex-col gap-3">
        <h2 id="camps-heading" className="text-lg font-semibold">
          Upcoming donation camps nearby
        </h2>
        {camps.data ? <CampsList camps={camps.data.camps} radiusKm={camps.data.radiusKm} /> : <SectionLoading rows={1} />}
      </section>
    </div>
  );
}
