import { listInboxThreads } from "@/lib/actions/inbox";
import { MobileInboxList } from "@/components/mobile-inbox-list";

export default async function MobileInboxPage() {
  const { threads } = await listInboxThreads();
  return <MobileInboxList threads={threads} />;
}
