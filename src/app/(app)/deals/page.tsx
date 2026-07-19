import { OpportunitiesView } from "@/components/opportunities-view";
import { listOpportunities } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";

export default async function DealsPage() {
  const [opportunities, stages] = await Promise.all([listOpportunities(), listPipelineStages()]);
  return <OpportunitiesView opportunities={opportunities} stages={stages} />;
}
