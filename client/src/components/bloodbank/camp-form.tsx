import { CalendarPlusIcon } from "lucide-react";
import { useRefresh } from "@/lib/refresh";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LatLng } from "@red-link/shared/domain/geo";
import { campSchema } from "@red-link/shared/validators";

interface FormValues {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  address: string;
}

const toIso = (local: string) => {
  const d = new Date(local);
  return local && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
};

/** Spec 8 /bloodbank/camps: create a donation camp (shown on nearby donors' home page). */
export function CampForm({ defaultLocation, defaultAddress }: { defaultLocation: LatLng | null; defaultAddress: string }) {
  const refresh = useRefresh();
  const [location, setLocation] = useState<LatLng | null>(defaultLocation);
  const [locationError, setLocationError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { title: "", description: "", startsAt: "", endsAt: "", address: defaultAddress } });

  async function onSubmit(v: FormValues) {
    setLocationError(null);
    const parsed = campSchema.safeParse({
      ...v,
      startsAt: toIso(v.startsAt),
      endsAt: toIso(v.endsAt),
      lat: location?.lat ?? NaN,
      lng: location?.lng ?? NaN,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (key === "lat" || key === "lng") setLocationError("Choose the camp location on the map.");
        else if (key in v) setError(key as FieldPath<FormValues>, { message: issue.message });
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }
    try {
      const res = await fetch("/api/bloodbank/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't create the camp.");
        return;
      }
      toast.success("Camp created. Donors within 25 km will see it on their home page.");
      reset({ title: "", description: "", startsAt: "", endsAt: "", address: defaultAddress });
      refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    }
  }

  const field = (name: FieldPath<FormValues>, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} {...props} {...register(name)} />
      {errors[name] ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[name]?.message}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {field("title", "Title")}
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} maxLength={500} aria-invalid={!!errors.description} {...register("description")} />
        {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("startsAt", "Starts", { type: "datetime-local" })}
        {field("endsAt", "Ends", { type: "datetime-local" })}
      </div>
      {field("address", "Venue address")}
      <LocationPicker
        value={location}
        onChange={(p) => {
          setLocation(p);
          setLocationError(null);
        }}
        invalid={!!locationError}
      />
      {locationError ? <p className="text-sm text-destructive">{locationError}</p> : null}
      <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
        <CalendarPlusIcon />
        {isSubmitting ? "Creating…" : "Create camp"}
      </Button>
    </form>
  );
}
