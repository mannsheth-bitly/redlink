import { SendIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BLOOD_GROUPS, INITIAL_RADIUS_KM, MAX_UNITS_PER_REQUEST } from "@red-link/shared/domain/constants";
import { toDateTimeLocalValue } from "@red-link/shared/format";
import type { HospitalOption } from "@red-link/shared/api";
import { receiverRequestSchema } from "@red-link/shared/validators";

interface FormValues {
  bloodGroup: string;
  unitsNeeded: string;
  urgency: string;
  neededBy: string;
  patientNote: string;
  hospitalId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isInFuture = (d: Date) => d.getTime() > Date.now();
const defaultNeededBy = () => toDateTimeLocalValue(new Date(Date.now() + DAY_MS));

/** Spec 7.B step 5: receivers raise NORMAL or URGENT requests at a verified hospital (owner decision). */
export function ReceiverRequestForm({ hospitals }: { hospitals: HospitalOption[] }) {
  const navigate = useNavigate();
  const [initialNeededBy] = useState(defaultNeededBy);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { bloodGroup: "", unitsNeeded: "1", urgency: "NORMAL", neededBy: initialNeededBy, patientNote: "", hospitalId: "" },
  });

  async function onSubmit(v: FormValues) {
    const neededBy = v.neededBy ? new Date(v.neededBy) : null;
    const payload = {
      bloodGroup: v.bloodGroup,
      unitsNeeded: Number(v.unitsNeeded),
      urgency: v.urgency,
      neededBy: neededBy && !Number.isNaN(neededBy.getTime()) ? neededBy.toISOString() : "",
      patientNote: v.patientNote || undefined,
      hospitalId: v.hospitalId,
    };
    const parsed = receiverRequestSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (key in v) setError(key as FieldPath<FormValues>, { message: issue.message });
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
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
          <Input id="unitsNeeded" type="number" min={1} max={MAX_UNITS_PER_REQUEST} {...a11y("unitsNeeded")} {...register("unitsNeeded")} />
          {err("unitsNeeded")}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Urgency</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["NORMAL", "URGENT"] as const).map((u) => (
            <label
              key={u}
              className="flex cursor-pointer flex-col rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <span className="flex items-center gap-2 font-semibold">
                <input type="radio" value={u} className="accent-primary" {...register("urgency")} />
                {u === "NORMAL" ? "Normal" : "Urgent"}
              </span>
              <span className="text-xs text-muted-foreground">Donors within {INITIAL_RADIUS_KM[u]} km of the hospital</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hospitalId">Hospital where the patient is admitted</Label>
        <NativeSelect id="hospitalId" {...a11y("hospitalId")} {...register("hospitalId")}>
          <option value="">Select a verified hospital…</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
              {h.distanceLabel ? ` (${h.distanceLabel})` : ""}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Donors go to this hospital, and its staff record each donation. Only verified hospitals are listed.
        </p>
        {err("hospitalId")}
      </div>

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
          placeholder="e.g. Surgery on Friday. Don't include the patient's name."
          {...a11y("patientNote")}
          {...register("patientNote")}
        />
        {err("patientNote")}
      </div>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={isSubmitting || hospitals.length === 0}>
        <SendIcon />
        {isSubmitting ? "Finding donors…" : "Raise request"}
      </Button>
    </form>
  );
}
