import { ContactsList } from "@/components/shared/contacts-list";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import type { ContactRequestItem } from "@red-link/shared/api";
import { useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";

export default function DonorContactsPage() {
  usePageTitle("Contact requests");
  const { data, error, reload } = useApi<{ contactRequests: ContactRequestItem[] }>("/api/contact-requests");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact requests</h1>
        <p className="text-muted-foreground">People who need blood can ask for your number. It&apos;s only shared if you accept.</p>
      </div>
      {error ? <PageError error={error} onRetry={reload} /> : data ? <ContactsList items={data.contactRequests} mode="donor" /> : <SectionLoading />}
    </div>
  );
}
