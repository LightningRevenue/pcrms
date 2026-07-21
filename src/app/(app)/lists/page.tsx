import { ListsView } from "@/components/lists-view";
import { listLists } from "@/lib/actions/lists";
import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";
import { RestrictedAppPage } from "@/components/restricted-app-page";

export default async function ListsPage() {
  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "lists_feature"))) {
    return <RestrictedAppPage message="Lists aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const lists = await listLists();
  return <ListsView lists={lists} />;
}
