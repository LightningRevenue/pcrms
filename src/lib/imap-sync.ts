import { ImapFlow, type MessageStructureObject, type SearchObject, type FetchMessageObject } from "imapflow";
import { db } from "@/lib/db";
import { publishNotification } from "@/lib/redis";
import { sendReplyEmailNotification } from "@/lib/reply-notification";
import { decrypt } from "@/lib/encryption";
import { cancelActiveEmailStepsOnReply } from "@/lib/sequence-runner";
import { cancelPendingCampaignStepsOnReply } from "@/lib/campaign-runner";
import type { MailboxAccount } from "@prisma/client";

function findBodyPart(node: MessageStructureObject, wantType: "text/html" | "text/plain"): MessageStructureObject | null {
  if (node.type.toLowerCase() === wantType && node.part) return node;
  for (const child of node.childNodes ?? []) {
    const found = findBodyPart(child, wantType);
    if (found) return found;
  }
  return null;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// imapflow's fetch({ bodyParts }) returns the raw part bytes as sent on the wire — it does not
// undo Content-Transfer-Encoding the way client.download() does (and download() has a known
// issue where it can hang forever on some servers, including the one this mailbox uses).
function decodeBodyPart(raw: Buffer, encoding?: string): string {
  switch ((encoding ?? "").toLowerCase()) {
    case "base64":
      return Buffer.from(raw.toString("utf8").replace(/\s+/g, ""), "base64").toString("utf8");
    case "quoted-printable": {
      // Decode into raw bytes first (each =XX is one byte, not one UTF-8 code point) so
      // multi-byte sequences like =C3=8E ("Î") reassemble correctly before the final UTF-8 decode.
      const ascii = raw.toString("latin1").replace(/=\r?\n/g, "");
      const bytes: number[] = [];
      for (let i = 0; i < ascii.length; i++) {
        if (ascii[i] === "=" && /[0-9A-Fa-f]{2}/.test(ascii.slice(i + 1, i + 3))) {
          bytes.push(parseInt(ascii.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          bytes.push(ascii.charCodeAt(i));
        }
      }
      return Buffer.from(bytes).toString("utf8");
    }
    default:
      return raw.toString("utf8");
  }
}

// The routine poll only ever reads INBOX, so everything it sees is inbound. A backfill also walks
// Sent, so direction is decided by whether the mailbox itself is the sender. The contact is then
// matched against whichever side *isn't* the mailbox — otherwise backfilled Sent mail, whose
// From is always the mailbox, would never link to the person it was addressed to.
export function resolveDirection(mailboxEmail: string, fromAddress: string, toAddresses: string[]) {
  const isSent = fromAddress.toLowerCase() === mailboxEmail.toLowerCase();
  return {
    direction: isSent ? ("sent" as const) : ("received" as const),
    counterparties: (isSent ? toAddresses : [fromAddress]).filter(Boolean),
  };
}

const CRON_JOB_NAME = "imap-mailbox-poll";
// Only look at recent mail — a mailbox can carry thousands of old messages, and walking the
// full UID range from imapLastUid=0 on first poll made this crawl for minutes without ever
// reaching the point where progress gets saved. SINCE is a server-side IMAP search filter,
// so this stays fast regardless of how large the mailbox's total history is.
const POLL_WINDOW_HOURS = 24;

async function saveMessage(
  client: ImapFlow,
  account: MailboxAccount,
  message: FetchMessageObject,
  // Backfilled history is not a new reply: it must not cancel live sequence/campaign steps and
  // must not raise "New reply from…" notifications for conversations that ended months ago.
  opts: { silent?: boolean } = {}
): Promise<{ saved: boolean; account: MailboxAccount }> {
  const exists = await db.email.findUnique({
    where: { mailboxAccountId_imapUid: { mailboxAccountId: account.id, imapUid: message.uid } },
  });
  if (exists) {
    // Same gap as the Gmail path: a message imported before the contact existed sits in the DB
    // with no personId, so the contact's Emails tab never shows it. Link it now if it's still
    // unclaimed — rows already attached to someone are left alone.
    if (!exists.personId) {
      const from = message.envelope?.from?.[0]?.address ?? "";
      const to = (message.envelope?.to ?? []).map((a) => a.address).filter((a): a is string => !!a);
      const { counterparties } = resolveDirection(account.email, from, to);
      const owner = counterparties.length
        ? await db.person.findFirst({
            where: {
              workspaceId: account.workspaceId,
              deletedAt: null,
              OR: counterparties.map((a) => ({ email: { equals: a, mode: "insensitive" as const } })),
            },
            select: { id: true },
          })
        : null;
      if (owner) await db.email.update({ where: { id: exists.id }, data: { personId: owner.id } });
    }
    if (message.uid > account.imapLastUid) {
      account = await db.mailboxAccount.update({ where: { id: account.id }, data: { imapLastUid: message.uid } });
    }
    return { saved: false, account };
  }

  // Fetches the part inline via bodyParts rather than client.download() — download() has a
  // known issue where it can hang forever without erroring on some IMAP servers (confirmed
  // against this mailbox's provider), while bodyParts returns instantly in the same fetch style.
  let bodyHtml = "";
  if (message.bodyStructure) {
    const htmlNode = findBodyPart(message.bodyStructure, "text/html");
    const node = htmlNode ?? findBodyPart(message.bodyStructure, "text/plain");
    if (node?.part) {
      for await (const withParts of client.fetch(
        message.uid.toString(),
        { uid: true, bodyParts: [node.part] },
        { uid: true }
      )) {
        const raw = withParts.bodyParts?.get(node.part);
        if (raw) {
          const text = decodeBodyPart(raw, node.encoding);
          bodyHtml = htmlNode ? text : `<p>${escapeHtml(text)}</p>`;
        }
      }
    }
  }

  const fromAddress = message.envelope?.from?.[0]?.address ?? "";
  const toAddresses = (message.envelope?.to ?? []).map((a) => a.address).filter((a): a is string => !!a);

  const { direction, counterparties } = resolveDirection(account.email, fromAddress, toAddresses);
  const person = counterparties.length
    ? await db.person.findFirst({
        where: {
          workspaceId: account.workspaceId,
          deletedAt: null,
          OR: counterparties.map((address) => ({ email: { equals: address, mode: "insensitive" as const } })),
        },
      })
    : null;

  const email = await db.email.create({
    data: {
      workspaceId: account.workspaceId,
      mailboxAccountId: account.id,
      imapUid: message.uid,
      messageIdHeader: message.envelope?.messageId ?? undefined,
      inReplyTo: message.envelope?.inReplyTo ?? undefined,
      direction,
      from: fromAddress,
      to: toAddresses,
      cc: (message.envelope?.cc ?? []).map((a) => a.address).filter((a): a is string => !!a),
      bcc: [],
      subject: message.envelope?.subject ?? "(no subject)",
      bodyHtml,
      sentAt: message.envelope?.date ?? new Date(),
      personId: person?.id,
    },
  });

  const isNewReply = direction === "received" && !opts.silent;

  if (person && isNewReply) {
    await cancelActiveEmailStepsOnReply(person.id, account.workspaceId);
    await cancelPendingCampaignStepsOnReply(person.id, account.workspaceId);
  }

  if (account.createdById && isNewReply) {
    const senderLabel = person
      ? [person.firstName, person.lastName].filter(Boolean).join(" ")
      : fromAddress;

    const notification = await db.notification.create({
      data: {
        workspaceId: account.workspaceId,
        userId: account.createdById,
        kind: "email_reply",
        title: `New reply from ${senderLabel}`,
        body: email.subject,
        link: person ? `/contacts/${person.id}?tab=emails&emailId=${email.id}` : `/inbox`,
      },
    });

    await publishNotification(account.createdById, notification);
  }

  if (isNewReply) {
    await sendReplyEmailNotification({ personId: person?.id ?? null, subject: email.subject, workspaceId: account.workspaceId });
  }

  // Save progress after every message, not just at the end — so a slow mailbox or a
  // crashed/killed poll never loses ground and re-scans messages it already saved. Only ever
  // moves forward: a backfill reads mail older than the mark, and letting that pull the mark
  // backwards would make the next routine poll re-scan everything in between.
  if (message.uid > account.imapLastUid) {
    account = await db.mailboxAccount.update({ where: { id: account.id }, data: { imapLastUid: message.uid } });
  }
  return { saved: true, account };
}

async function fetchAndSave(
  client: ImapFlow,
  account: MailboxAccount,
  search: SearchObject,
  // The routine poll skips anything at or below the high-water mark. A backfill has to ignore
  // it — the whole point is reading mail older than the last poll. saveMessage dedupes on
  // (mailboxAccountId, imapUid) either way, so re-reading is safe, just slower.
  opts: { ignoreHighWaterMark?: boolean; silent?: boolean } = {}
) {
  // imapflow's connection handles one command at a time — issuing a second fetch() (for
  // bodyParts, inside saveMessage) while the first fetch()'s AsyncIterableIterator is still
  // open deadlocks the connection forever. Drain this iterator to a plain array first, so the
  // per-message bodyParts fetch below always runs against an idle connection.
  const messages: FetchMessageObject[] = [];
  for await (const message of client.fetch(search, { uid: true, envelope: true, bodyStructure: true })) {
    if (opts.ignoreHighWaterMark || message.uid > account.imapLastUid) messages.push(message);
  }

  let found = 0;
  for (const message of messages) {
    const result = await saveMessage(client, account, message, { silent: opts.silent });
    account = result.account;
    if (result.saved) found++;
  }
  return { found, account };
}

export async function pollMailboxAccount(account: MailboxAccount) {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: { user: account.username, pass: decrypt(account.password) },
    logger: false,
    connectionTimeout: 10_000,
  });

  let found = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - POLL_WINDOW_HOURS * 60 * 60 * 1000);

      // Only known CRM contacts — these mailboxes carry heavy daily warmup traffic (automated
      // sends between accounts to keep deliverability up), so an unscoped SINCE search matches
      // thousands of irrelevant messages. Scoping FROM to CRM contacts keeps this fast.
      const crmEmails = (await db.person.findMany({ where: { workspaceId: account.workspaceId, deletedAt: null, email: { not: null } }, select: { email: true } }))
        .map((p) => p.email)
        .filter((e): e is string => !!e);

      if (crmEmails.length > 0) {
        const pass = await fetchAndSave(client, account, {
          since,
          or: crmEmails.map((email) => ({ from: email })),
        });
        account = pass.account;
        found += pass.found;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  return found;
}

// Fallback names for the Sent folder when the server doesn't advertise the \Sent special-use
// flag. Matched against the last path segment, lowercased, so "[Gmail]/Sent Mail" works too.
const SENT_FOLDER_NAMES = new Set([
  "sent",
  "sent items",
  "sent mail",
  "sent messages",
  "outbox",
]);

// Backfill for one address across one mailbox: every message to or from it, no date window and
// no UID floor. Unlike the routine poll this also walks Sent — prior outbound mail to a lead is
// exactly the history worth surfacing — so it searches both directions and both folders.
export async function backfillAddressOnMailbox(account: MailboxAccount, address: string) {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: { user: account.username, pass: decrypt(account.password) },
    logger: false,
    connectionTimeout: 10_000,
  });

  let found = 0;
  try {
    await client.connect();

    // \Sent is the special-use flag, but not every server advertises it — Maildoso (the provider
    // behind these inboxes) returns no specialUse at all while plainly having a "Sent" folder.
    // Relying on the flag alone silently skipped Sent everywhere, so prior outbound mail to a
    // lead never got imported. Falls back to matching common folder names.
    const folders = await client.list();
    const sent =
      folders.find((box) => box.specialUse === "\\Sent") ??
      folders.find((box) => SENT_FOLDER_NAMES.has(box.path.split(box.delimiter ?? "/").pop()?.toLowerCase() ?? ""));
    const boxes = ["INBOX", ...(sent ? [sent.path] : [])];

    for (const box of boxes) {
      const lock = await client.getMailboxLock(box);
      try {
        const pass = await fetchAndSave(
          client,
          account,
          { or: [{ from: address }, { to: address }] },
          { ignoreHighWaterMark: true, silent: true }
        );
        account = pass.account;
        found += pass.found;
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  return found;
}

// How many mailboxes to poll concurrently per batch — enough to cut wall-clock time
// meaningfully without opening dozens of simultaneous connections to the same IMAP provider.
const POLL_BATCH_SIZE = 8;

export async function runImapPollAll() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let emailsFound = 0;
  try {
    // Poll every active mailbox, not just ones the CRM has sent from — a reply can land on a
    // mailbox the CRM never sent through (a lookalike address picked from Gmail's autocomplete,
    // a message sent outside the CRM entirely, etc.), and restricting to "used" mailboxes
    // silently drops those replies forever. The per-mailbox FROM+SINCE narrowing plus batching
    // below keeps this fast without needing to guess which mailboxes matter.
    const accounts = await db.mailboxAccount.findMany({ where: { active: true } });

    for (let i = 0; i < accounts.length; i += POLL_BATCH_SIZE) {
      const batch = accounts.slice(i, i + POLL_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((account) =>
          pollMailboxAccount(account).catch(() => 0) // one mailbox failing (bad creds, host down) shouldn't stop the rest — checkMailboxAccount already surfaces per-mailbox connection errors in Settings
        )
      );
      emailsFound += results.reduce((sum, n) => sum + n, 0);
    }

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date(), emailsFound, error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }

  return emailsFound;
}
