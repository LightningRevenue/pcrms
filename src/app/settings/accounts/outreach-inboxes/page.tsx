import { SettingsHeader } from "@/components/settings-header";
import { MailboxAccountsManager } from "@/components/mailbox-accounts-manager";
import { listMailboxAccounts } from "@/lib/actions/mailbox-accounts";

export default async function OutreachInboxesPage() {
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
