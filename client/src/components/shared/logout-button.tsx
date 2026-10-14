import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function LogoutButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    // Clear the user first, so /login doesn't bounce a still-logged-in user back to the dashboard.
    // (The page's guard then redirects to /login too; both land on the same plain URL.)
    await logout();
    toast.success("Logged out");
    navigate("/login", { replace: true });
  }

  return (
    <Button variant="outline" onClick={() => void onClick()} disabled={pending} className={className}>
      <LogOutIcon />
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
