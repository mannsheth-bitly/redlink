import { NotificationsList } from "@/components/shared/notifications";
import { usePageTitle } from "@/lib/page-title";

export default function NotificationsPage() {
  usePageTitle("Notifications");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <NotificationsList />
    </div>
  );
}
