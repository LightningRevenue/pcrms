import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { getObjectDefinitionBySlug } from "@/lib/actions/objects";
import { EditObjectView } from "@/components/edit-object-view";

export default async function EditObjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "custom_objects_feature"))) {
    return <RestrictedAppPage message="Custom objects aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const object = await getObjectDefinitionBySlug(slug);
  if (!object) notFound();

  return <EditObjectView objectDefinitionId={object.id} name={object.name} fields={object.fields} />;
}
