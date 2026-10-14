import { BanIcon, ClockIcon, XCircleIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CONTENT = {
  PENDING_VERIFICATION: {
    icon: ClockIcon,
    title: "Awaiting verification",
    description:
      "Your organisation account has been created. A Red Link admin will verify your details before you can create requests or record donations. You'll get a notification once it's reviewed.",
  },
  REJECTED: {
    icon: XCircleIcon,
    title: "Verification rejected",
    description: "A Red Link admin could not verify your organisation.",
  },
  SUSPENDED: {
    icon: BanIcon,
    title: "Account suspended",
    description: "This account has been suspended by a Red Link admin.",
  },
} as const;

/** Shown instead of the dashboard when the account isn't ACTIVE (spec 7.C). */
export function AccountStatusScreen({
  status,
  orgName,
  rejectionNote,
}: {
  status: keyof typeof CONTENT;
  orgName?: string | null;
  rejectionNote?: string | null;
}) {
  const { icon: Icon, title, description } = CONTENT[status];
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <Icon className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          {orgName ? <p className="text-sm font-medium">{orgName}</p> : null}
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {rejectionNote ? (
            <p className="rounded-md border bg-muted p-3 text-sm">
              <span className="font-medium">Admin note: </span>
              {rejectionNote}
            </p>
          ) : null}
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
