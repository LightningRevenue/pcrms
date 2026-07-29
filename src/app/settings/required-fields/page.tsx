import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { RequiredFieldsManager } from "@/components/required-fields-manager";
import { getRequiredPersonFields } from "@/lib/actions/required-fields";

export default async function RequiredFieldsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Required fields"]} requiredRole="owner" />;
  }

  const config = await getRequiredPersonFields();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Required fields"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Required fields</h1>
        <p className="text-[13px] text-subtle mt-1">
          Choose what a contact must have before it can be created. Applies to the New Person form and to CSV
          imports — an imported row missing a required field is reported as an error and skipped, the rest of the
          file still imports. The example CSV updates to match.
        </p>

        <RequiredFieldsManager config={config} />
      </div>
    </>
  );
}
