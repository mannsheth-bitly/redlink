import { useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/lib/page-title";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  usePageTitle("Log in");
  const [params] = useSearchParams();
  const next = params.get("next");
  // Only accept local paths (no "//evil.com" open redirects).
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Log in</CardTitle>
          <CardDescription>Welcome back to Red Link.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeNext} />
        </CardContent>
      </Card>
    </div>
  );
}
