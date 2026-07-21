import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { MailboxAccountsManager } from "@/components/mailbox-accounts-manager";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { listMailboxAccounts } from "@/lib/actions/mailbox-accounts";
import { hasFeatureAccess } from "@/lib/entitlements";

export default async function OutreachInboxesPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Accounts", "Outreach Inboxes"]} requiredRole="owner" />;
  }
  if (session.user.workspaceId && !(await hasFeatureAccess(session.user.workspaceId, "outreach_inboxes_feature"))) {
    return (
      <RestrictedSettingsPage
        crumbs={["Accounts", "Outreach Inboxes"]}
        message="Outreach inboxes aren't available on your current plan. Ask your workspace owner to upgrade."
      />
    );
  }

  const accounts = await listMailboxAccounts();

  return (
    <>
      <SettingsHeader crumbs={["Accounts", "Outreach Inboxes"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Outreach Inboxes</h1>
        <p className="text-[13px] text-subtle mt-1">
          Connect mailboxes via SMTP/IMAP to send and track outreach outside your primary Gmail account.
        </p>

        <MailboxAccountsManager accounts={accounts} />
      </div>
    </>
  );
}
