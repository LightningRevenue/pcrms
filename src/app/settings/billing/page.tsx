import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { getBillingSnapshot } from "@/lib/actions/billing";
import { BillingView } from "@/components/billing-view";

export default async function BillingPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Billing"]} requiredRole="owner" />;
  }

  const { plan, usage, features } = await getBillingSnapshot();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Billing"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Billing</h1>
        <p className="text-[13px] text-subtle mt-2">Your plan and current usage.</p>

        <BillingView planName={plan.name} usage={usage} features={features} />
      </div>
    </>
  );
}
