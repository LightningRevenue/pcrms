// Shared between the inbox server action and the client view. Lives outside
// actions/inbox.ts because a "use server" file may only export async functions.
export const INBOX_PAGE_SIZE = 50;

export type InboxFilters = {
  tab?: "received" | "sent" | "all";
  q?: string;
  ownerIds?: string[];
  companyIds?: string[];
  campaignIds?: string[];
  mailboxIds?: string[];
  /** "linked" = sender matched a CRM contact, "unlinked" = unrecognized sender. */
  linked?: "linked" | "unlinked";
  /** Last message in the thread is outbound — you're waiting on a reply. */
  unanswered?: boolean;
  opened?: boolean;
  /** Rolling window in days (7 / 30 / 90). */
  days?: number;
  page?: number;
};
