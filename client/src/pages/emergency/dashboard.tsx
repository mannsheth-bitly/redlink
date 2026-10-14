import { SirenIcon } from "lucide-react";
import { Link } from "react-router";
import { CRITICAL_ESCALATED_RADIUS_KM, INITIAL_RADIUS_KM } from "@red-link/shared/domain/constants";
import DashboardPage from "@/pages/shared/dashboard";

export default function EmergencyDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Spec 8: large red CRITICAL BROADCAST button that pre-fills urgency = CRITICAL. */}
      <Link
        to="/emergency/requests/new?urgency=CRITICAL"
        className="group flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-6"
      >
        <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary-foreground/20 motion-reduce:animate-none" aria-hidden="true" />
          <SirenIcon className="size-8" aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-wide sm:text-3xl">CRITICAL BROADCAST</span>
          <span className="text-sm opacity-90">
            Alert donors within {INITIAL_RADIUS_KM.CRITICAL} km now. Widens to {CRITICAL_ESCALATED_RADIUS_KM} km automatically if
            fewer than 3 accept in 10 minutes.
          </span>
        </span>
      </Link>
      <DashboardPage base="/emergency" title="Emergency dashboard" />
    </div>
  );
}
