import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { TrashManager } from "@/components/trash-manager";
import { listTrash } from "@/lib/actions/trash";

export default async function TrashPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Trash"]} requiredRole="admin" />;
  }

  const items = await listTrash();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Trash"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Trash</h1>
        <p className="text-[13px] text-subtle mt-2 mb-6">
          Deleted companies, contacts, and opportunities stay here for 30 days before being
          permanently removed.
        </p>

        <TrashManager items={items} />
      </div>
    </>
  );
}
