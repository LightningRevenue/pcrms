import { db } from "@/lib/db";
import { publishNotification } from "@/lib/redis";
import { sendFromNotificationInbox } from "@/lib/notification-inbox-send";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

export type MentionableMember = { userId: string; name: string };

// The note textarea inserts "@Full Name " (trailing space) when you pick someone from the
// dropdown — parsing just re-finds those exact names rather than trying to guess word
// boundaries around arbitrary @-typed text, since the dropdown is the only way to add a
// mention (see note-mention-input.tsx).
export function parseMentionedUserIds(body: string, members: MentionableMember[]): string[] {
  const found = new Set<string>();
  for (const member of members) {
    if (body.includes(`@${member.name}`)) found.add(member.userId);
  }
  return [...found];
}

function buildMentionEmailHtml(opts: { mentionedByName: string; excerpt: string; goToUrl: string }) {
  return `
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <div style="width: 40px; height: 40px; border-radius: 10px; background: #4a63e7; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; margin-bottom: 24px;">C</div>
  <h1 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">New Mention</h1>
  <p style="font-size: 14px; color: #666; margin: 0 0 4px;">${escapeHtml(opts.mentionedByName)} mentioned you in a note:</p>
  <p style="font-size: 14px; color: #1a1a1a; margin: 0 0 24px; line-height: 1.5; padding: 12px; background: #f5f5f7; border-radius: 8px;">${escapeHtml(opts.excerpt)}</p>
  <a href="${opts.goToUrl}" style="display: inline-block; background: #4a63e7; color: white; text-decoration: none; font-size: 13px; font-weight: 500; padding: 10px 18px; border-radius: 8px;">View note</a>
</div>`.trim();
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Creates the NoteMention rows, an in-app Notification (bell, pushed live over Redis) and a
// best-effort "New Mention" email for each mentioned user — called right after a Note is
// created. Failures here never roll back the note itself; a mention is a courtesy ping, not
// part of the note's own data integrity.
export async function notifyMentionedUsers(opts: {
  noteId: string;
  noteBody: string;
  personId: string;
  mentionedByUserId: string;
  mentionedByName: string;
  workspaceId: string;
  userIds: string[];
}) {
  if (opts.userIds.length === 0) return;

  await db.noteMention.createMany({
    data: opts.userIds.map((userId) => ({ workspaceId: opts.workspaceId, noteId: opts.noteId, userId })),
    skipDuplicates: true,
  });

  const excerpt = opts.noteBody.length > 140 ? `${opts.noteBody.slice(0, 140)}…` : opts.noteBody;
  const baseUrl = await getTrackingBaseUrlForWorker();
  const link = `/contacts/${opts.personId}?tab=notes&noteId=${opts.noteId}`;

  for (const userId of opts.userIds) {
    if (userId === opts.mentionedByUserId) continue; // don't notify yourself for your own mention

    try {
      const notification = await db.notification.create({
        data: {
          workspaceId: opts.workspaceId,
          userId,
          kind: "note_mention",
          title: `${opts.mentionedByName} mentioned you`,
          body: excerpt,
          link,
        },
      });
      await publishNotification(userId, notification);
    } catch {
      // ponytail: best-effort — a failed bell notification shouldn't block the email below
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) continue;
      await sendFromNotificationInbox(
        user.email,
        "New Mention",
        buildMentionEmailHtml({ mentionedByName: opts.mentionedByName, excerpt, goToUrl: `${baseUrl}${link}` }),
        opts.workspaceId
      );
    } catch {
      // ponytail: best-effort — e.g. no notification inbox configured yet in Settings
    }
  }
}
