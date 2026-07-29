import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { ImportPanel } from "@/components/import-panel";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { hasFeatureAccess } from "@/lib/entitlements";
import { activeRequiredFields } from "@/lib/required-fields";
import { getRequiredPersonFields } from "@/lib/actions/required-fields";

export default async function ImportPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Import"]} requiredRole="admin" />;
  }
  if (session.user.workspaceId && !(await hasFeatureAccess(session.user.workspaceId, "csv_import_feature"))) {
    return (
      <RestrictedSettingsPage
        crumbs={["Workspace", "Import"]}
        message="CSV import isn't available on your current plan. Ask your workspace owner to upgrade."
      />
    );
  }

  // Drives the "(required)" markers in the downloadable example CSV, so the template matches
  // what the import will accept.
  const requiredPersonKeys = activeRequiredFields(await getRequiredPersonFields()).map((f) => f.key);

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Import"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Import</h1>
        <p className="text-[13px] text-subtle mt-1">Bring Companies or People in from a CSV file</p>

        <ImportPanel requiredPersonKeys={requiredPersonKeys} />
      </div>
    </>
  );
}
