import { OpportunitiesView } from "@/components/opportunities-view";
import { listOpportunities } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listMembers } from "@/lib/actions/members";

export default async function DealsPage() {
  const [opportunities, stages, users] = await Promise.all([listOpportunities(), listPipelineStages(), listMembers()]);
  return <OpportunitiesView opportunities={opportunities} stages={stages} users={users} />;
}
