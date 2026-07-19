import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/actions/campaigns";
import { CampaignBuilderView } from "@/components/campaign-builder-view";
import { CampaignDashboardView } from "@/components/campaign-dashboard-view";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  if (campaign.status !== "draft") {
    return <CampaignDashboardView campaign={campaign} />;
  }

  return <CampaignBuilderView campaign={campaign} />;
}
