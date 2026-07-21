import { auth } from "@/lib/auth";
import { CampaignsView } from "@/components/campaigns-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { listCampaigns } from "@/lib/actions/campaigns";
import { hasFeatureAccess } from "@/lib/entitlements";

export default async function MarketingCampaignsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access marketing. Contact your workspace owner if you need access." />;
  }
  if (session.user.workspaceId && !(await hasFeatureAccess(session.user.workspaceId, "campaigns_feature"))) {
    return <RestrictedAppPage message="Marketing campaigns aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const campaigns = await listCampaigns();
  return <CampaignsView campaigns={campaigns} />;
}
