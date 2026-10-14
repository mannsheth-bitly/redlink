import { SendIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BLOOD_GROUPS, INITIAL_RADIUS_KM, MAX_UNITS_PER_REQUEST, type Urgency } from "@red-link/shared/domain/constants";
import type { LatLng } from "@red-link/shared/domain/geo";
import { toDateTimeLocalValue } from "@red-link/shared/format";
import { cn } from "@/lib/utils";
import { createRequestSchema } from "@red-link/shared/validators";

interface FormValues {
  bloodGroup: string;
  unitsNeeded: string;
  urgency: string;
  neededBy: string;
  patientNote: string;
  hospitalName: string;
  hospitalAddress: string;
}


const URGENCY_HELP: Record<Urgency, string> = {
  NORMAL: `Donors within ${INITIAL_RADIUS_KM.NORMAL} km`,
  URGENT: `Donors within ${INITIAL_RADIUS_KM.URGENT} km (can be expanded)`,
  CRITICAL: `Donors within ${INITIAL_RADIUS_KM.CRITICAL} km, expands automatically`,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const isInFuture = (d: Date) => d.getTime() > Date.now();
const defaultNeededBy = () => toDateTimeLocalValue(new Date(Date.now() + DAY_MS));

/** Spec 7.A step 1: blood group, units, urgency, needed-by, note, and location (defaults to the institution's address). */
export function NewRequestForm({
  urgencies,
  defaultUrgency,
  defaults,
}: {
  urgencies: Urgency[];
  defaultUrgency: Urgency;
  defaults: { hospitalName: string; hospitalAddress: string; location: LatLng | null };
}) {
  const navigate = useNavigate();
  const [location, setLocation] = useState<LatLng | null>(defaults.location);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [initialNeededBy] = useState(defaultNeededBy);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      bloodGroup: "",
      unitsNeeded: "1",
      urgency: defaultUrgency,
      neededBy: initialNeededBy,
      patientNote: "",
      hospitalName: defaults.hospitalName,
      hospitalAddress: defaults.hospitalAddress,
    },
  });
  const urgency = useWatch({ control, name: "urgency" }) as Urgency;

  async function onSubmit(v: FormValues) {
    setLocationError(null);
    const neededBy = v.neededBy ? new Date(v.neededBy) : null;
    const payload = {
      bloodGroup: v.bloodGroup,
      unitsNeeded: Number(v.unitsNeeded),
      urgency: v.urgency,
      neededBy: neededBy && !Number.isNaN(neededBy.getTime()) ? neededBy.toISOString() : "",
      patientNote: v.patientNote || undefined,
      hospitalName: v.hospitalName,
      hospitalAddress: v.hospitalAddress,
      lat: location?.lat ?? NaN,
      lng: location?.lng ?? NaN,
    };
    const parsed = createRequestSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (key === "lat" || key === "lng") setLocationError("Choose where donors should go on the map.");
        else if (key in v) setError(key as FieldPath<FormValues>, { message: issue.message });
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (neededBy && !isInFuture(neededBy)) {
      setError("neededBy", { message: "Must be in the future" });
      return;
    }
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: { path?: string; matchedCount?: number; error?: string } = await res.json();
      if (!res.ok || !data.path) {
        toast.error(data.error ?? "Couldn't create the request.");
        return;
      }
      toast.success(
        data.matchedCount
          ? `Request sent to ${data.matchedCount} matched donor${data.matchedCount === 1 ? "" : "s"}`
          : "Request created. No eligible donors in range yet.",
      );
      navigate(data.path);
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    }
  }

  const err = (name: FieldPath<FormValues>) =>
    errors[name]?.message ? (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {errors[name]?.message}
      </p>
    ) : null;
  const a11y = (name: FieldPath<FormValues>) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-4" aria-labelledby="need-heading">
        <h2 id="need-heading" className="font-semibold">
          What is needed
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bloodGroup">Patient&apos;s blood group</Label>
            <NativeSelect id="bloodGroup" {...a11y("bloodGroup")} {...register("bloodGroup")}>
              <option value="">Select…</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g.replace("-", "−")}
                </option>
              ))}
            </NativeSelect>
            {err("bloodGroup")}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="unitsNeeded">Units needed</Label>
            <Input id="unitsNeeded" type="number" min={1} max={MAX_UNITS_PER_REQUEST} inputMode="numeric" {...a11y("unitsNeeded")} {...register("unitsNeeded")} />
            {err("unitsNeeded")}
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Urgency</legend>
          <div className={cn("grid gap-2", urgencies.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {urgencies.map((u) => (
              <label
                key={u}
                className={cn(
                  "flex cursor-pointer flex-col rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  u === "CRITICAL" && "has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input type="radio" value={u} className="accent-primary" {...register("urgency")} />
                  {u.charAt(0) + u.slice(1).toLowerCase()}
                </span>
                <span className={cn("text-xs", u === "CRITICAL" && urgency === "CRITICAL" ? "opacity-90" : "text-muted-foreground")}>
                  {URGENCY_HELP[u]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="neededBy">Needed by</Label>
            <Input id="neededBy" type="datetime-local" {...a11y("neededBy")} {...register("neededBy")} />
            {err("neededBy")}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="patientNote">Note for donors (optional)</Label>
          <Textarea
            id="patientNote"
            rows={2}
            maxLength={200}
            placeholder="e.g. Accident case, ICU. Don't include the patient's name."
            {...a11y("patientNote")}
            {...register("patientNote")}
          />
          {err("patientNote")}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="where-heading">
        <h2 id="where-heading" className="font-semibold">
          Where donors should go
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="hospitalName">Hospital name</Label>
            <Input id="hospitalName" {...a11y("hospitalName")} {...register("hospitalName")} />
            {err("hospitalName")}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hospitalAddress">Hospital address</Label>
            <Input id="hospitalAddress" {...a11y("hospitalAddress")} {...register("hospitalAddress")} />
            {err("hospitalAddress")}
          </div>
        </div>
        <LocationPicker
          value={location}
          onChange={(p) => {
            setLocation(p);
            setLocationError(null);
          }}
          invalid={!!locationError}
          describedBy={locationError ? "location-error" : undefined}
        />
        {locationError ? (
          <p id="location-error" className="text-sm text-destructive">
            {locationError}
          </p>
        ) : null}
      </section>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={isSubmitting}>
        <SendIcon />
        {isSubmitting ? "Finding donors…" : "Broadcast request"}
      </Button>
    </form>
  );
}
