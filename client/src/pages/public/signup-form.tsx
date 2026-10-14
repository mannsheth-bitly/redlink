import { AmbulanceIcon, HospitalIcon, SearchIcon, UserIcon, WarehouseIcon } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { BLOOD_GROUPS, GENDERS, isInstitutionRole, type SignupRole } from "@red-link/shared/domain/constants";
import type { LatLng } from "@red-link/shared/domain/geo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { signupSchema } from "@red-link/shared/validators";

const ROLE_OPTIONS: { role: SignupRole; title: string; body: string; icon: typeof UserIcon }[] = [
  { role: "DONOR", title: "Donor", body: "I want to donate blood", icon: UserIcon },
  { role: "RECEIVER", title: "Patient / family", body: "I need blood for someone", icon: SearchIcon },
  { role: "HOSPITAL", title: "Hospital", body: "Hospital staff account", icon: HospitalIcon },
  { role: "EMERGENCY", title: "Emergency service", body: "Ambulance / emergency responder", icon: AmbulanceIcon },
  { role: "BLOOD_BANK", title: "Blood bank", body: "Blood bank administrator", icon: WarehouseIcon },
];

interface FormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  address: string;
  city: string;
  pincode: string;
  bloodGroup: string;
  dateOfBirth: string;
  gender: string;
  weightKg: string;
  lastDonationAt: string;
  orgName: string;
  licenseNumber: string;
}

const EMPTY: FormValues = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  address: "",
  city: "Mumbai",
  pincode: "",
  bloodGroup: "",
  dateOfBirth: "",
  gender: "",
  weightKg: "",
  lastDonationAt: "",
  orgName: "",
  licenseNumber: "",
};

/** Maps a server/zod path like ["location","pincode"] to the form field name. */
function toFieldName(path: PropertyKey[]): FieldPath<FormValues> | "location" | null {
  const [first, second] = path;
  if (first === "location") {
    if (second === "address" || second === "city" || second === "pincode") return second;
    return "location";
  }
  if (typeof first === "string" && first in EMPTY) return first as FieldPath<FormValues>;
  return null;
}


export function SignupForm({ initialRole }: { initialRole: SignupRole | null }) {
  const navigate = useNavigate();
  const { reload } = useAuth();
  const [role, setRole] = useState<SignupRole | null>(initialRole);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: EMPTY });

  const institution = role !== null && isInstitutionRole(role);

  async function onSubmit(v: FormValues) {
    if (!role) return;
    setLocationError(null);

    if (v.password !== v.confirmPassword) {
      setError("confirmPassword", { message: "Passwords don't match" });
      return;
    }

    const payload = {
      role,
      name: v.name,
      email: v.email,
      phone: v.phone,
      password: v.password,
      // A placeholder point fails validation below with a clear message instead of a type error.
      location: { lat: location?.lat ?? NaN, lng: location?.lng ?? NaN, address: v.address, city: v.city, pincode: v.pincode },
      ...(role === "DONOR"
        ? {
            bloodGroup: v.bloodGroup,
            dateOfBirth: v.dateOfBirth,
            gender: v.gender,
            weightKg: v.weightKg === "" ? NaN : Number(v.weightKg),
            lastDonationAt: v.lastDonationAt || undefined,
          }
        : {}),
      ...(institution ? { orgName: v.orgName, licenseNumber: v.licenseNumber } : {}),
    };

    // Validate in the browser first with the same zod schema the API uses.
    const parsed = signupSchema.safeParse(payload);
    if (!parsed.success) {
      let focused = false;
      for (const issue of parsed.error.issues) {
        const field = toFieldName(issue.path);
        if (field === "location") {
          setLocationError("Choose a location: use your location or click on the map.");
        } else if (field) {
          setError(field, { message: issue.message }, { shouldFocus: !focused });
          focused = true;
        }
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: { redirectTo?: string; error?: string } = await res.json();
      if (!res.ok || !data.redirectTo) {
        toast.error(data.error ?? "Sign up failed.");
        return;
      }
      toast.success(institution ? "Account created. Awaiting admin verification." : "Welcome to Red Link!");
      await reload();
      navigate(data.redirectTo, { replace: true });
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    }
  }

  if (!role) {
    return (
      <fieldset>
        <legend className="mb-3 text-sm font-medium">I am signing up as…</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_OPTIONS.map(({ role: r, title, body, icon: Icon }) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{body}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </fieldset>
    );
  }

  const selected = ROLE_OPTIONS.find((o) => o.role === role)!;

  const field = (
    name: FieldPath<FormValues>,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    hint?: string,
  ) => {
    const error = errors[name]?.message;
    const describedBy = [error ? `${name}-error` : null, hint ? `${name}-hint` : null].filter(Boolean).join(" ");
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={name}>{label}</Label>
        <Input id={name} aria-invalid={!!error} aria-describedby={describedBy || undefined} {...props} {...register(name)} />
        {hint ? (
          <p id={`${name}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${name}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const selectField = (name: FieldPath<FormValues>, label: string, options: readonly string[], display?: (o: string) => string) => {
    const error = errors[name]?.message;
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={name}>{label}</Label>
        <NativeSelect
          id={name}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          {...register(name)}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {display ? display(o) : o}
            </option>
          ))}
        </NativeSelect>
        {error ? (
          <p id={`${name}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
        <div className="flex items-center gap-2">
          <selected.icon className="size-5 text-primary" aria-hidden="true" />
          <span className="font-medium">Signing up as: {selected.title}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRole(null)}>
          Change
        </Button>
      </div>

      {institution ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Organisation accounts are reviewed by a Red Link admin before they can be used.
        </p>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="account-heading">
        <h2 id="account-heading" className="font-semibold">
          {institution ? "Organisation & contact person" : "Your details"}
        </h2>
        {institution ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {field("orgName", "Organisation name")}
            {field("licenseNumber", "Registration / licence number")}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", institution ? "Contact person's full name" : "Full name", { autoComplete: "name" })}
          {field("phone", "Mobile number", { type: "tel", autoComplete: "tel", inputMode: "tel" }, "10-digit Indian mobile number")}
        </div>
        {field("email", "Email", { type: "email", autoComplete: "email" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("password", "Password", { type: "password", autoComplete: "new-password" }, "At least 8 characters")}
          {field("confirmPassword", "Confirm password", { type: "password", autoComplete: "new-password" })}
        </div>
      </section>

      {role === "DONOR" ? (
        <section className="flex flex-col gap-4" aria-labelledby="donor-heading">
          <h2 id="donor-heading" className="font-semibold">
            Donor details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {selectField("bloodGroup", "Blood group", BLOOD_GROUPS, (g) => g.replace("-", "−"))}
            {selectField("gender", "Gender", GENDERS, (g) => g.charAt(0) + g.slice(1).toLowerCase())}
            {field("dateOfBirth", "Date of birth", { type: "date" })}
            {field("weightKg", "Weight (kg)", { type: "number", inputMode: "decimal", min: 20, max: 250, step: "0.1" })}
          </div>
          {field(
            "lastDonationAt",
            "Last donation date (optional)",
            { type: "date" },
            "Leave empty if you have never donated. Donors must wait 90 days between donations.",
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="location-heading">
        <h2 id="location-heading" className="font-semibold">
          {institution ? "Organisation location" : "Your location"}
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          Used to calculate distances for matching. Your exact location is never shown to other users.
        </p>
        <LocationPicker
          value={location}
          onChange={(p) => {
            setLocation(p);
            setLocationError(null);
          }}
          onAddressPick={(r) => {
            setValue("address", r.label.split(",").slice(0, 3).join(",").trim());
            if (r.city) setValue("city", r.city);
            if (r.pincode) setValue("pincode", r.pincode);
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
          {field("city", "City", { autoComplete: "address-level2" })}
          {field("pincode", "Pincode", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 6 })}
        </div>
      </section>

      <Button type="submit" size="lg" className={cn("h-11 text-base")} disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
