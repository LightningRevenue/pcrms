import { UnifiedInboxView } from "@/components/unified-inbox-view";
import { listInboxThreads, listInboxFilterOptions } from "@/lib/actions/inbox";
import type { InboxFilters } from "@/lib/inbox-filters";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";
import { listActiveMailboxAccounts } from "@/lib/actions/mailbox-accounts";

// Filters live in the URL so a filtered inbox is a shareable/bookmarkable link — that's
// also what makes "saved views" free later.
function parseFilters(params: Record<string, string | string[] | undefined>): InboxFilters {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) || undefined;
  const many = (k: string) => one(k)?.split(",").filter(Boolean) ?? undefined;
  const tab = one("tab");
  const linked = one("linked");
  return {
    tab: tab === "sent" || tab === "all" ? tab : "received",
    q: one("q"),
    ownerIds: many("owner"),
    companyIds: many("company"),
    campaignIds: many("campaign"),
    mailboxIds: many("mailbox"),
    linked: linked === "linked" || linked === "unlinked" ? linked : undefined,
    unanswered: one("unanswered") === "1",
    opened: one("opened") === "1",
    days: one("days") ? Number(one("days")) : undefined,
    page: one("page") ? Number(one("page")) : 1,
  };
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const [{ threads, total }, mailboxes, allMailboxes, options] = await Promise.all([
    listInboxThreads(filters),
    listMyMailboxOptions(),
    listActiveMailboxAccounts(),
    listInboxFilterOptions(),
  ]);

  return (
    <UnifiedInboxView
      threads={threads}
      total={total}
      filters={filters}
      options={options}
      mailboxes={mailboxes}
      allMailboxes={allMailboxes}
    />
  );
}
