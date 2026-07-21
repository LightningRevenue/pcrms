import { auth } from "@/lib/auth";
import { listPlaybooks } from "@/lib/actions/playbooks";
import { PlaybooksView } from "@/components/playbooks-view";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { hasFeatureAccess } from "@/lib/entitlements";

export default async function PlaybooksPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Resources", "Playbook Templates"]} requiredRole="admin" />;
  }
  if (session.user.workspaceId && !(await hasFeatureAccess(session.user.workspaceId, "playbooks_feature"))) {
    return (
      <RestrictedSettingsPage
        crumbs={["Resources", "Playbook Templates"]}
        message="Playbooks aren't available on your current plan. Ask your workspace owner to upgrade."
      />
    );
  }

  const playbooks = await listPlaybooks();

  return <PlaybooksView playbooks={playbooks} />;
}
