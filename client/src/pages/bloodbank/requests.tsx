import { SupplyRequests } from "@/components/bloodbank/supply-requests";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import type { SupplyableRequest } from "@red-link/shared/api";
import { BLOOD_BANK_SUPPLY_RADIUS_KM } from "@red-link/shared/domain/constants";
import { useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";

export default function SupplyRequestsPage() {
  usePageTitle("Open requests");
  const { data, error, reload } = useApi<{ requests: SupplyableRequest[] }>("/api/bloodbank/open-requests");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Open requests you can supply</h1>
        <p className="text-muted-foreground">
          Requests within {BLOOD_BANK_SUPPLY_RADIUS_KM} km where you have a compatible blood group in stock. Stock is only
          taken when the requester accepts your offer.
        </p>
      </div>
      {error ? <PageError error={error} onRetry={reload} /> : data ? <SupplyRequests items={data.requests} /> : <SectionLoading />}
    </div>
  );
}
