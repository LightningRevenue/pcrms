import { db } from "@/lib/db";
import { LeadIntelligenceView } from "@/components/lead-intelligence-view";
import { listProspectFilterOptions } from "@/lib/actions/prospect-search";
import { requireWorkspace } from "@/lib/workspace";

export default async function LeadIntelligencePage() {
  const { workspaceId } = await requireWorkspace();

  // Campaigns for the "add to campaign" action — drafts included, since building an audience
  // before starting the campaign is the normal order of work.
  const [options, campaigns] = await Promise.all([
    listProspectFilterOptions(),
    db.campaign.findMany({
      where: { workspaceId, status: { in: ["draft", "active"] } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <LeadIntelligenceView options={options} campaigns={campaigns} />;
}
