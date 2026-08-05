// The raw call to the SMTP verification service. Lives here rather than in
// actions/email-verify.ts because that file is "use server" — worker/verify-worker.ts needs
// this without dragging in Next's server-action machinery. actions/email-verify.ts re-exports
// it, so existing callers are unchanged.
export type EmailVerifyResult = {
  valid: boolean;
  catchAll: boolean;
  reason: string;
};

// A catch-all domain accepts every address, so "valid" there means nothing — catchAll wins.
export function statusOf(data: { valid: boolean; catchAll: boolean }) {
  if (data.catchAll) return "catch-all";
  return data.valid ? "valid" : "invalid";
}

export type DownloadKind = "valid" | "valid-catch-all" | "invalid" | "all";

// Which stored statuses each download option pulls. undefined = no filter (everything).
// Lives here rather than in the "use server" action file so it can be unit-tested.
export const DOWNLOAD_STATUSES: Record<DownloadKind, string[] | undefined> = {
  valid: ["valid"],
  "valid-catch-all": ["valid", "catch-all"],
  invalid: ["invalid"],
  all: undefined,
};

// Header names a lead-list export is likely to use for the address column, best guess first.
const EMAIL_HEADER_HINTS = ["email", "email address", "e-mail", "work email", "mail"];

// Picks the address column by header name, falling back to whichever column actually contains
// the most "@" values — exported lists often name the column something unpredictable.
export function guessEmailColumn(headers: string[], sampleRows: string[][]): string | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const hint of EMAIL_HEADER_HINTS) {
    const i = normalized.indexOf(hint);
    if (i !== -1) return headers[i];
  }
  if (headers.length === 0) return null;
  const counts = headers.map((_, idx) => sampleRows.filter((r) => (r[idx] ?? "").includes("@")).length);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] > 0 ? headers[best] : null;
}

export async function callVerifyApi(email: string): Promise<EmailVerifyResult> {
  const res = await fetch(process.env.SMTP_VERIFY_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SMTP_VERIFY_API_KEY}`,
    },
    body: JSON.stringify({ email }),
    // Without this a hung mail server stalls a worker slot indefinitely; a batch of 5k
    // addresses only needs one such host to sit forever. 30s is well past a real handshake.
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Verification service error (${res.status})`);
  const data = await res.json();
  return { valid: data.valid, catchAll: data.catchAll, reason: data.reason };
}
