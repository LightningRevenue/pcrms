import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { getObjectDefinitionBySlug, listObjectRecords } from "@/lib/actions/objects";
import { ObjectRecordsView } from "@/components/object-records-view";

export default async function ObjectRecordsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "custom_objects_feature"))) {
    return <RestrictedAppPage message="Custom objects aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const object = await getObjectDefinitionBySlug(slug);
  if (!object) notFound();

  const records = await listObjectRecords(object.id);

  return <ObjectRecordsView object={object} records={records} />;
}
