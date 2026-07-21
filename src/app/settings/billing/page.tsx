import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";

export default async function BillingPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Billing"]} requiredRole="owner" />;
  }

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Billing"]} />
      <div className="px-8 py-10">
        <h1 className="text-xl font-medium">Billing</h1>
        <p className="text-[13px] text-subtle mt-2">Coming soon.</p>
      </div>
    </>
  );
}
