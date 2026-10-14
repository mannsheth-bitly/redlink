import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { loginSchema, type LoginInput } from "@red-link/shared/validators";

export function LoginForm({ next }: { next: string | null }) {
  const navigate = useNavigate();
  const { reload } = useAuth();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { redirectTo?: string; error?: string } = await res.json();
      if (!res.ok || !data.redirectTo) {
        toast.error(data.error ?? "Login failed.");
        return;
      }
      toast.success("Welcome back!");
      // Only follow `next` if it's inside this user's own area; otherwise go to their dashboard.
      const target = next && next.startsWith(data.redirectTo) ? next : data.redirectTo;
      await reload(); // load the signed-in user before entering the guarded pages
      navigate(target, { replace: true });
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
    }
  }

  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          {errors.password ? (
            <p id="password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to Red Link?{" "}
          <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </form>

      {demoMode ? (
        <Collapsible className="rounded-lg border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-sm font-medium">
            Demo accounts
            <ChevronDownIcon
              className="size-4 transition-transform group-data-[panel-open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                All passwords are <code className="font-mono">{DEMO_PASSWORD}</code>. Click one to fill the form.
              </p>
              <ul className="flex flex-col gap-1">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button
                      type="button"
                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2"
                      onClick={() => {
                        setValue("email", a.email, { shouldValidate: true });
                        setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                      }}
                    >
                      <span className="font-medium">{a.label}</span>
                      <span className="text-xs text-muted-foreground">{a.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
