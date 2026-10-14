import { useRefresh } from "@/lib/refresh";
import { useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { BLOOD_GROUPS, GENDERS } from "@red-link/shared/domain/constants";
import type { LatLng } from "@red-link/shared/domain/geo";
import { donorProfileUpdateSchema } from "@red-link/shared/validators";

export interface ProfileValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  bloodGroup: string;
  dateOfBirth: string;
  gender: string;
  weightKg: string;
  lastDonationAt: string;
}


const FIELD_FOR_PATH: Record<string, FieldPath<ProfileValues>> = {
  "location.address": "address",
  "location.city": "city",
  "location.pincode": "pincode",
};

/** Owner decision: donors can edit every field. Changing a verified blood group removes the Verified badge. */
export function ProfileForm({
  initial,
  initialLocation,
  verified,
}: {
  initial: ProfileValues;
  initialLocation: LatLng | null;
  verified: boolean;
}) {
  const refresh = useRefresh();
  const [location, setLocation] = useState<LatLng | null>(initialLocation);
  const [locationError, setLocationError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ defaultValues: initial });

  const groupChanging = useWatch({ control, name: "bloodGroup" }) !== initial.bloodGroup;
  const locationChanged =
    location?.lat !== initialLocation?.lat || location?.lng !== initialLocation?.lng;

  async function onSubmit(v: ProfileValues) {
    setLocationError(null);
    if (groupChanging && verified) {
      const ok = window.confirm(
        "Changing your blood group will remove your Verified badge and withdraw you from requests you're no longer compatible with. Continue?",
      );
      if (!ok) return;
    }
    const payload = {
      name: v.name,
      email: v.email,
      phone: v.phone,
      location: { lat: location?.lat ?? NaN, lng: location?.lng ?? NaN, address: v.address, city: v.city, pincode: v.pincode },
      bloodGroup: v.bloodGroup,
      dateOfBirth: v.dateOfBirth,
      gender: v.gender,
      weightKg: v.weightKg === "" ? NaN : Number(v.weightKg),
      lastDonationAt: v.lastDonationAt || null,
    };
    const parsed = donorProfileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path === "location.lat" || path === "location.lng") {
          setLocationError("Choose your location on the map or use your current location.");
          continue;
        }
        const field = FIELD_FOR_PATH[path] ?? (path in initial ? (path as FieldPath<ProfileValues>) : null);
        if (field) setError(field, { message: issue.message });
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }
    try {
      const res = await fetch("/api/donor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save your profile.");
        return;
      }
      toast.success("Profile saved");
      refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    }
  }

  const field = (name: FieldPath<ProfileValues>, label: string, props: React.ComponentProps<typeof Input> = {}) => {
    const error = errors[name]?.message;
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={name}>{label}</Label>
        <Input id={name} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} {...props} {...register(name)} />
        {error ? (
          <p id={`${name}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const select = (name: FieldPath<ProfileValues>, label: string, options: readonly string[], display: (o: string) => string) => {
    const error = errors[name]?.message;
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={name}>{label}</Label>
        <NativeSelect id={name} aria-invalid={!!error} {...register(name)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {display(o)}
            </option>
          ))}
        </NativeSelect>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-4" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="font-semibold">
          Contact details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Full name", { autoComplete: "name" })}
          {field("phone", "Mobile number", { type: "tel", autoComplete: "tel" })}
        </div>
        {field("email", "Email", { type: "email", autoComplete: "email" })}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="donor-heading">
        <h2 id="donor-heading" className="font-semibold">
          Donor details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {select("bloodGroup", "Blood group", BLOOD_GROUPS, (g) => g.replace("-", "−"))}
          {select("gender", "Gender", GENDERS, (g) => g.charAt(0) + g.slice(1).toLowerCase())}
          {field("dateOfBirth", "Date of birth", { type: "date" })}
          {field("weightKg", "Weight (kg)", { type: "number", inputMode: "decimal", step: "0.1" })}
        </div>
        {groupChanging && verified ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Your current blood group was verified at a recorded donation. Changing it removes the Verified badge.
          </p>
        ) : null}
        {field("lastDonationAt", "Last donation date (optional)", { type: "date" })}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="location-heading">
        <h2 id="location-heading" className="font-semibold">
          Location
        </h2>
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
        {field("address", "Address", { autoComplete: "street-address" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("city", "City")}
          {field("pincode", "Pincode", { inputMode: "numeric", maxLength: 6 })}
        </div>
      </section>

      <Button type="submit" size="lg" className="h-11 text-base" disabled={isSubmitting || (!isDirty && !locationChanged)}>
        {isSubmitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
