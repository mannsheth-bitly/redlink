import { useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signupRoleSchema } from "@red-link/shared/validators";
import { usePageTitle } from "@/lib/page-title";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  usePageTitle("Sign up");
  const [params] = useSearchParams();
  const parsed = signupRoleSchema.safeParse(params.get("role"));

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your Red Link account</CardTitle>
          <CardDescription>Choose how you&apos;ll use Red Link.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm initialRole={parsed.success ? parsed.data : null} />
        </CardContent>
      </Card>
    </div>
  );
}
