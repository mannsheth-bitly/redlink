import { useParams } from "react-router";
import { RequestView } from "@/components/institution/request-view";
import { PageError, SectionLoading } from "@/components/shared/page-state";
import type { RequestView as RequestViewData } from "@red-link/shared/api";
import { useApi } from "@/lib/api";
import { usePageTitle } from "@/lib/page-title";

/** Requester / chosen hospital view of a request (spec 7.A step 4). */
export default function RequestDetailPage({ back }: { back: string }) {
  usePageTitle("Request");
  const { id } = useParams();
  const { data, error, reload } = useApi<RequestViewData>(`/api/requests/${id}`);
  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return <SectionLoading />;
  return <RequestView key={id} initial={data} base={back} />;
}
