import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampaign } from "@/lib/actions/campaigns";
import { CampaignBuilderView } from "@/components/campaign-builder-view";
import { CampaignDashboardView } from "@/components/campaign-dashboard-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { hasFeatureAccess } from "@/lib/entitlements";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access marketing. Contact your workspace owner if you need access." />;
  }
  if (session.user.workspaceId && !(await hasFeatureAccess(session.user.workspaceId, "campaigns_feature"))) {
    return <RestrictedAppPage message="Marketing campaigns aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  if (campaign.status !== "draft") {
    return <CampaignDashboardView campaign={campaign} />;
  }

  return <CampaignBuilderView campaign={campaign} />;
}
