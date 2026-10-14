import { InventoryGrid } from "@/components/bloodbank/inventory-grid";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import type { InventoryTile } from "@red-link/shared/api";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";

export default function InventoryPage() {
  usePageTitle("Inventory");
  const user = useUser();
  const { data, error, reload } = useApi<{ inventory: InventoryTile[] }>("/api/bloodbank/inventory");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">{user.institution?.orgName}</p>
      </div>
      {error ? (
        <PageError error={error} onRetry={reload} />
      ) : data ? (
        <InventoryGrid key={JSON.stringify(data.inventory)} initial={data.inventory} />
      ) : (
        <SectionLoading rows={2} />
      )}
    </div>
  );
}
