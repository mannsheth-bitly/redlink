import { useSearchParams } from "react-router";
import { NewRequestForm } from "@/components/institution/new-request-form";
import { ReceiverRequestForm } from "@/components/receiver/receiver-request-form";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import { Card, CardContent } from "@/components/ui/card";
import type { HospitalOption } from "@red-link/shared/api";
import { URGENCIES, type Role, type Urgency } from "@red-link/shared/domain/constants";
import { allowedUrgencies } from "@red-link/shared/domain/requests";
import { useApi } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";

function ReceiverNewRequest() {
  const { data, error, reload } = useApi<{ hospitals: HospitalOption[] }>("/api/hospitals");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Raise a blood request</h1>
        <p className="text-muted-foreground">
          Compatible donors near the hospital are alerted. Your request is marked as an individual request.
        </p>
      </div>
      <Card>
        <CardContent>
          {error ? (
            <PageError error={error} onRetry={reload} />
          ) : !data ? (
            <SectionLoading rows={2} />
          ) : data.hospitals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No verified hospitals are registered yet.</p>
          ) : (
            <ReceiverRequestForm hospitals={data.hospitals} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Shared /requests/new for Hospital, Emergency (spec 8: shared components) and Receiver. */
export default function NewRequestPage() {
  usePageTitle("New request");
  const user = useUser();
  const [params] = useSearchParams();
  if (user.role === "RECEIVER") return <ReceiverNewRequest />;

  const urgencies = allowedUrgencies(user.role as Role);
  const param = params.get("urgency");
  const requested = param && (URGENCIES as readonly string[]).includes(param) ? (param as Urgency) : null;
  const defaultUrgency = requested && urgencies.includes(requested) ? requested : urgencies[0];
  // Spec 7.A step 1: location defaults to the institution's address. A hospital is usually where
  // donors go; an emergency service names the receiving hospital itself.
  const isHospital = user.role === "HOSPITAL";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New blood request</h1>
        <p className="text-muted-foreground">Compatible, eligible donors nearby are notified immediately.</p>
      </div>
      <Card>
        <CardContent>
          <NewRequestForm
            key={defaultUrgency}
            urgencies={urgencies}
            defaultUrgency={defaultUrgency}
            defaults={{
              hospitalName: isHospital ? (user.institution?.orgName ?? "") : "",
              hospitalAddress: isHospital ? (user.address ?? "") : "",
              location: user.lat !== null && user.lng !== null ? { lat: user.lat, lng: user.lng } : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
