import { SettingsHeader } from "@/components/settings-header";
import { NotificationInboxManager } from "@/components/notification-inbox-manager";
import { getNotificationInboxOptions } from "@/lib/actions/notification-inbox";

export default async function EmailNotificationsPage() {
  const { owner, mailboxes, selected, canEdit } = await getNotificationInboxOptions();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Email Notifications"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Email Notifications</h1>
        <p className="text-[13px] text-subtle mt-1">
          Choose the inbox internal CRM notifications (e.g. a teammate gets assigned something) send from.
          This applies to the whole workspace.
        </p>
        {!canEdit && (
          <p className="text-[12px] text-subtle mt-2">Only the workspace owner can change this setting.</p>
        )}

        <h2 className="text-[13px] font-semibold mt-8">Selected Inbox</h2>
        <NotificationInboxManager owner={owner} mailboxes={mailboxes} selected={selected} canEdit={canEdit} />
      </div>
    </>
  );
}
