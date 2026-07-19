import { CampaignsView } from "@/components/campaigns-view";
import { listCampaigns } from "@/lib/actions/campaigns";

export default async function MarketingCampaignsPage() {
  const campaigns = await listCampaigns();
  return <CampaignsView campaigns={campaigns} />;
}
