import { Link } from "react-router";
import { BloodGroupPill } from "@/components/shared/blood-group-pill";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DonationRow } from "@red-link/shared/api";
import { formatDateTime } from "@red-link/shared/format";
import { useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";

/** Spec 8 /donations: donations recorded by this hospital / emergency service / blood bank. */
export function DonationsTable({ base }: { base: string }) {
  const { data, error, reload } = useApi<{ donations: DonationRow[] }>("/api/donations");
  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return <SectionLoading />;
  const donations = data.donations;
  const totalUnits = donations.reduce((s, d) => s + d.units, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Donations recorded</h2>
        <p className="text-muted-foreground">
          {donations.length} donation{donations.length === 1 ? "" : "s"} · {totalUnits} unit{totalUnits === 1 ? "" : "s"}
        </p>
      </div>
      {donations.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No donations recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Request</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(d.donatedAt)}</TableCell>
                  <TableCell>{d.donorName}</TableCell>
                  <TableCell>
                    <BloodGroupPill group={d.bloodGroup} className="min-w-9 text-xs" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.units}</TableCell>
                  <TableCell>
                    {d.requestId ? (
                      <Link to={`${base}/requests/${d.requestId}`} className="text-primary hover:underline">
                        View
                      </Link>
                    ) : (
                      "Walk-in"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function DonationsPage({ base }: { base: string }) {
  usePageTitle("Donations");
  return <DonationsTable base={base} />;
}
