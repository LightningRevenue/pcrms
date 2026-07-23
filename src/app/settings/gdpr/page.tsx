import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { GdprManager } from "@/components/gdpr-manager";
import { listGdprRequests, listUnsubscribedContacts, getUnsubscribeFooterText } from "@/lib/actions/gdpr";
import { isGdprModuleEnabled } from "@/lib/gdpr";

export default async function GdprPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "GDPR"]} requiredRole="owner" />;
  }
  if (!session.user.workspaceId || !(await isGdprModuleEnabled(session.user.workspaceId))) {
    return (
      <RestrictedSettingsPage
        crumbs={["Workspace", "GDPR"]}
        message="GDPR tracking isn't available on your current plan. Ask your workspace owner to upgrade."
      />
    );
  }

  const [requests, unsubscribed, footerText] = await Promise.all([
    listGdprRequests(),
    listUnsubscribedContacts(),
    getUnsubscribeFooterText(),
  ]);

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "GDPR"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">GDPR</h1>
        <p className="text-[13px] text-subtle mt-1">
          Track data-subject requests and manage contacts who&apos;ve unsubscribed. Every outbound email includes an
          unsubscribe link and header — clicking it blocks all future emails to that contact, including manual
          sends.
        </p>

        <GdprManager requests={requests} unsubscribed={unsubscribed} footerText={footerText} />
      </div>
    </>
  );
}
