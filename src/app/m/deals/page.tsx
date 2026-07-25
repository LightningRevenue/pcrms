import { listOpportunities } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { MobileDealsList } from "@/components/mobile-deals-list";

export default async function MobileDealsPage() {
  const [opportunities, stages] = await Promise.all([listOpportunities(), listPipelineStages()]);
  return <MobileDealsList opportunities={opportunities} stages={stages} />;
}
