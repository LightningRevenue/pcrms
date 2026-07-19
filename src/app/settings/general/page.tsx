import { SettingsHeader } from "@/components/settings-header";
import { MailboxPreferencesManager } from "@/components/mailbox-preferences-manager";
import { listMyMailboxPreferences } from "@/lib/actions/mailbox-preferences";

export default async function GeneralPage() {
  const mailboxes = await listMyMailboxPreferences();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "General"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">General</h1>

        <section className="mt-8">
          <h2 className="text-[13px] font-semibold">My outreach mailboxes</h2>
          <p className="text-[12px] text-subtle mt-1">
            Choose which connected SMTP/IMAP mailboxes are yours to send from by default.
          </p>
          <MailboxPreferencesManager mailboxes={mailboxes} />
        </section>
      </div>
    </>
  );
}
