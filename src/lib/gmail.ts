import { db } from "@/lib/db";

export async function getValidAccessToken(userId: string) {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) throw new Error("No connected Google account");

  const expiresAt = account.expires_at ?? 0;
  const isExpired = expiresAt * 1000 < Date.now() + 60_000;
  if (!isExpired) return account.access_token;

  if (!account.refresh_token) throw new Error("Google account needs to be reconnected");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh Google token: ${await res.text()}`);

  const refreshed = await res.json();
  const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;

  await db.account.update({
    where: { id: account.id },
    data: { access_token: refreshed.access_token, expires_at: newExpiresAt },
  });

  return refreshed.access_token as string;
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function buildMimeMessage(opts: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
  references?: string[];
}) {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to.join(", ")}`,
    opts.cc?.length ? `Cc: ${opts.cc.join(", ")}` : null,
    opts.bcc?.length ? `Bcc: ${opts.bcc.join(", ")}` : null,
    `Subject: ${encodeHeader(opts.subject)}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.references?.length ? `References: ${opts.references.join(" ")}` : null,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset="UTF-8"`,
    "Content-Transfer-Encoding: 7bit",
  ].filter(Boolean);

  return `${headers.join("\r\n")}\r\n\r\n${opts.bodyHtml}`;
}

export async function sendGmailMessage(opts: {
  userId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
}) {
  const accessToken = await getValidAccessToken(opts.userId);
  const raw = buildMimeMessage(opts);
  const encoded = Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encoded,
      threadId: opts.threadId,
    }),
  });

  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  const sent = (await res.json()) as { id: string; threadId: string };

  const messageIdHeader = await getMessageIdHeader(accessToken, sent.id);

  return { ...sent, messageIdHeader };
}

async function getMessageIdHeader(accessToken: string, gmailMessageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=metadata&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const header = data.payload?.headers?.find(
    (h: { name: string; value: string }) => h.name.toLowerCase() === "message-id"
  );
  return header?.value ?? null;
}

export type GmailThreadMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  messageIdHeader: string | null;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyHtml: string;
  internalDate: Date;
  labelIds: string[];
};

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

// ponytail: quoted-reply markers cover Gmail/Outlook HTML — plain-text ">" quoting
// (older clients, forwarded mail) isn't stripped since it's indistinguishable from real content.
const QUOTE_MARKERS = [
  /<div class="gmail_quote"/i,
  /<blockquote/i,
  /<div id="?appendonsend"?/i, // Outlook
];

function stripQuotedReply(html: string): string {
  let cutIndex = html.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(html);
    if (match && match.index < cutIndex) cutIndex = match.index;
  }
  return html.slice(0, cutIndex).trim();
}

// ponytail: language-agnostic "> " quoting used by plain-text reply chains — also
// drops the preceding "On ... wrote:" / "În ... a scris:" attribution paragraph
// (the non-blank block of lines directly above the first quoted line).
function stripQuotedPlainText(text: string): string {
  const lines = text.split("\n");
  const quoteStart = lines.findIndex((line) => line.trimStart().startsWith(">"));
  if (quoteStart === -1) return text;

  let end = quoteStart;
  while (end > 0 && lines[end - 1].trim() === "") end -= 1;
  while (end > 0 && lines[end - 1].trim() !== "") end -= 1;
  return lines.slice(0, end).join("\n").trim();
}

function extractBodyHtml(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return stripQuotedReply(decodeBase64Url(payload.body.data));
  }
  if (payload.mimeType === "text/plain" && payload.body?.data && !payload.parts) {
    const plain = stripQuotedPlainText(decodeBase64Url(payload.body.data));
    return plain.replace(/\n/g, "<br>");
  }
  for (const part of payload.parts ?? []) {
    const html = extractBodyHtml(part as typeof payload);
    if (html) return html;
  }
  return "";
}

function parseAddressList(value?: string) {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function fetchThreadMessages(userId: string, gmailThreadId: string) {
  const accessToken = await getValidAccessToken(userId);

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailThreadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Failed to fetch Gmail thread: ${await res.text()}`);

  const data = await res.json();
  const messages: GmailThreadMessage[] = (data.messages ?? []).map(
    (m: {
      id: string;
      threadId: string;
      internalDate: string;
      labelIds?: string[];
      payload: { headers: Array<{ name: string; value: string }> } & Parameters<
        typeof extractBodyHtml
      >[0];
    }) => {
      const headers = m.payload.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

      return {
        gmailMessageId: m.id,
        gmailThreadId: m.threadId,
        messageIdHeader: getHeader("Message-Id") ?? null,
        from: getHeader("From") ?? "",
        to: parseAddressList(getHeader("To")),
        cc: parseAddressList(getHeader("Cc")),
        subject: getHeader("Subject") ?? "",
        bodyHtml: extractBodyHtml(m.payload),
        internalDate: new Date(Number(m.internalDate)),
        labelIds: m.labelIds ?? [],
      };
    }
  );

  return messages;
}
