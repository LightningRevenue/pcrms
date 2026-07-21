import { UnifiedInboxView } from "@/components/unified-inbox-view";
import { listInboxThreads } from "@/lib/actions/inbox";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";
import { listActiveMailboxAccounts } from "@/lib/actions/mailbox-accounts";

export default async function InboxPage() {
  const [threads, mailboxes, allMailboxes] = await Promise.all([
    listInboxThreads(),
    listMyMailboxOptions(),
    listActiveMailboxAccounts(),
  ]);

  return <UnifiedInboxView threads={threads} mailboxes={mailboxes} allMailboxes={allMailboxes} />;
}
