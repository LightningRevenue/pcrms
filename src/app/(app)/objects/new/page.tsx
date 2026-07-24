import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { NewObjectView } from "@/components/new-object-view";

export default async function NewObjectPage() {
  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "custom_objects_feature"))) {
    return <RestrictedAppPage message="Custom objects aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  return <NewObjectView />;
}
