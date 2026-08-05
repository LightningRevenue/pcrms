import { db } from "@/lib/db";
import { searchThreadIds } from "@/lib/gmail";
import { syncGmailThread } from "@/lib/gmail-sync";
import { backfillAddressOnMailbox } from "@/lib/imap-sync";

// Higher than the routine poll's batch size. Measured against these inboxes: the IMAP *search*
// takes ~130ms but the TLS connect+login takes ~4.5s, so a backfill is almost entirely idle
// waiting on handshakes — and a workspace here has ~57 mailboxes. At 8 that's 8 serial rounds of
// ~5s each; at 20 it's 3. Kept well under the mailbox count so we never open 57 sockets at once.
// ponytail: fixed 20, revisit if a provider starts refusing concurrent connections.
const BACKFILL_BATCH_SIZE = 20;

export type HistoryBackfillJobData = { personId: string; workspaceId: string };

// The contact may have been deleted mid-backfill, which makes the update throw — that must not
// turn into a failed job, since the work itself succeeded.
async function setStatus(personId: string, status: "running" | "done" | "failed") {
  await db.person.update({ where: { id: personId }, data: { historyBackfillStatus: status } }).catch(() => {});
}

// Both sync engines are forward-only by design: the IMAP poll searches a 24h window above a UID
// high-water mark, and the Gmail sync can only refetch threads the CRM itself seeded by sending.
// So a contact added *after* you'd already emailed them starts with an empty timeline. This runs
// once per new contact and pulls that prior history in across every connected mailbox.
export async function runHistoryBackfill({ personId, workspaceId }: HistoryBackfillJobData) {
  const person = await db.person.findFirst({
    where: { id: personId, workspaceId, deletedAt: null },
    select: { email: true },
  });
  // No address to search on (or the contact was deleted before the worker got here) — clear the
  // flag so the Emails tab doesn't spin on a backfill that can never produce anything.
  if (!person?.email) {
    await setStatus(personId, "done");
    return 0;
  }

  await setStatus(personId, "running");

  const address = person.email;
  let found = 0;

  try {
    // --- SMTP/IMAP mailboxes ---
    // Batched rather than one-at-a-time: each mailbox costs a fresh connect + login + two folder
    // searches, so a workspace with a dozen inboxes was spending most of the run waiting on
    // round trips. Same batch size as the routine poll — the ceiling is how many simultaneous
    // connections the IMAP hosts tolerate, which doesn't change just because this is a backfill.
    const mailboxes = await db.mailboxAccount.findMany({ where: { workspaceId, active: true } });
    for (let i = 0; i < mailboxes.length; i += BACKFILL_BATCH_SIZE) {
      const results = await Promise.all(
        mailboxes.slice(i, i + BACKFILL_BATCH_SIZE).map((mailbox) =>
          // One bad mailbox (creds rotated, host down) shouldn't cost the contact the history
          // sitting in all the others — checkMailboxAccount surfaces per-mailbox errors in Settings.
          backfillAddressOnMailbox(mailbox, address).catch(() => 0)
        )
      );
      found += results.reduce((sum, n) => sum + n, 0);
    }

    // --- Gmail accounts ---
    // Scoped to users who are actually members of this workspace, so a backfill never reaches into
    // a Gmail account connected under a different tenant.
    const members = await db.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    const googleAccounts = members.length
      ? await db.account.findMany({
          where: { provider: "google", userId: { in: members.map((m) => m.userId) } },
          select: { userId: true },
        })
      : [];

    // Accounts run in parallel, but threads within one account stay sequential: syncGmailThread
    // dedupes by reading the Email rows already written for that thread, so overlapping writes to
    // the same thread would race the check and insert duplicates.
    const gmailCounts = await Promise.all(
      googleAccounts.map(async ({ userId }) => {
        let count = 0;
        try {
          const threadIds = await searchThreadIds(userId, address);
          for (const threadId of threadIds) {
            count += await syncGmailThread(userId, threadId, personId, workspaceId, { silent: true });
          }
        } catch {
          // Same rationale as mailboxes above: a revoked/expired Google grant is surfaced
          // elsewhere and must not abort the rest of the backfill.
        }
        return count;
      })
    );
    found += gmailCounts.reduce((sum, n) => sum + n, 0);
  } catch (err) {
    // Per-source failures are already swallowed above, so reaching here means something
    // unexpected (DB down mid-run). Mark terminal regardless — a stuck "running" would leave the
    // Emails tab spinning forever.
    await setStatus(personId, "failed");
    throw err;
  }

  await setStatus(personId, "done");
  return found;
}
