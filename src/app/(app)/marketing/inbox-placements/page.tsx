import { auth } from "@/lib/auth";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { hasFeatureAccess } from "@/lib/entitlements";
import { InboxPlacementsView } from "@/components/inbox-placements-view";

export default async function MarketingInboxPlacementsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access marketing. Contact your workspace owner if you need access." />;
  }
  if (session.user.workspaceId && !(await hasFeatureAccess(session.user.workspaceId, "campaigns_feature"))) {
    return <RestrictedAppPage message="Marketing campaigns aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  return <InboxPlacementsView />;
}
