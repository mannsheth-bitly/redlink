import { CheckIcon } from "lucide-react";
import { canDonateTo } from "@red-link/shared/domain/compatibility";
import { BLOOD_GROUPS } from "@red-link/shared/domain/constants";

const show = (g: string) => g.replace("-", "−");

/** 8×8 red-cell compatibility grid generated from the domain rules (spec 5.2). */
export function CompatibilityChart() {
  return (
    // `relative` keeps the absolutely positioned sr-only labels inside this scroll box on narrow screens.
    <div className="relative overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[34rem] border-collapse text-center text-sm">
        <caption className="sr-only">
          Blood group compatibility: rows are the patient (recipient), columns are the donor. A tick means the
          donor can give to that patient.
        </caption>
        <thead>
          <tr className="bg-muted">
            <th scope="col" className="p-2 text-left text-xs font-medium text-muted-foreground">
              Patient ↓ / Donor →
            </th>
            {BLOOD_GROUPS.map((donor) => (
              <th key={donor} scope="col" className="p-2 font-extrabold">
                {show(donor)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOOD_GROUPS.map((recipient) => (
            <tr key={recipient} className="border-t">
              <th scope="row" className="bg-muted/50 p-2 text-left font-extrabold">
                {show(recipient)}
              </th>
              {BLOOD_GROUPS.map((donor) => {
                const ok = canDonateTo(donor, recipient);
                return (
                  <td key={donor} className={ok ? "bg-primary/10 p-2" : "p-2 text-muted-foreground"}>
                    {ok ? (
                      <CheckIcon className="mx-auto size-4 text-primary" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">–</span>
                    )}
                    <span className="sr-only">
                      {show(donor)} {ok ? "can" : "cannot"} donate to {show(recipient)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
