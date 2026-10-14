import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { usePageTitle } from "@/lib/page-title";

export default function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link to="/" className={buttonVariants()}>
        Go to the home page
      </Link>
    </div>
  );
}
