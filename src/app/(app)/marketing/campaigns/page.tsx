import { auth } from "@/lib/auth";
import { CampaignsView } from "@/components/campaigns-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { listCampaigns } from "@/lib/actions/campaigns";

export default async function MarketingCampaignsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access marketing. Contact your workspace owner if you need access." />;
  }

  const campaigns = await listCampaigns();
  return <CampaignsView campaigns={campaigns} />;
}
