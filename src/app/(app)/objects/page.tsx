import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { listObjectDefinitions } from "@/lib/actions/objects";
import { ObjectsListView } from "@/components/objects-list-view";

export default async function ObjectsPage() {
  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "custom_objects_feature"))) {
    return <RestrictedAppPage message="Custom objects aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const objects = await listObjectDefinitions();
  return <ObjectsListView objects={objects} />;
}
