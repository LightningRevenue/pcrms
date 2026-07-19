import { UnifiedInboxView } from "@/components/unified-inbox-view";
import { listInboxThreads } from "@/lib/actions/inbox";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";

export default async function InboxPage() {
  const [threads, mailboxes] = await Promise.all([listInboxThreads(), listMyMailboxOptions()]);

  return <UnifiedInboxView threads={threads} mailboxes={mailboxes} />;
}
