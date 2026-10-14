import { Link } from "react-router";
import { DonorSearch } from "@/components/search/donor-search";
import { buttonVariants } from "@/components/ui/button-variants";
import { DEFAULT_MAP_CENTER } from "@red-link/shared/domain/constants";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";

/** Masked donor search: receivers (with contact requests), hospitals and emergency services (owner decision). */
export default function FindDonorsPage({ allowContact, admin = false }: { allowContact: boolean; admin?: boolean }) {
  usePageTitle("Find donors");
  const user = useUser();
  const centre = user.lat !== null && user.lng !== null ? { lat: user.lat, lng: user.lng } : { ...DEFAULT_MAP_CENTER };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Find donors</h1>
        <p className="text-muted-foreground">
          {admin
            ? "Masked search of donors who can donate now, as receivers and hospitals see it. You can change the search location to any area."
            : allowContact
              ? "Search for compatible donors near you and ask them to share their number."
              : "Masked search of donors who can donate now. To contact donors, create a request — they'll be alerted and their numbers appear when they accept."}
        </p>
      </div>
      <DonorSearch initialCentre={centre} allowContact={allowContact} />
      {allowContact ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
          <p className="text-sm">
            <span className="font-semibold">Prefer not to search manually?</span> Raise a request and every compatible donor
            nearby is alerted.
          </p>
          <Link to="/receiver/requests/new" className={buttonVariants({ variant: "outline" })}>
            Raise a request
          </Link>
        </div>
      ) : null}
    </div>
  );
}
