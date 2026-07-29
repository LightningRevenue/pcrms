import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { hasFeatureAccess } from "@/lib/entitlements";

// Gate for the entire GDPR module (Settings > GDPR page + unsubscribe enforcement) — an
// add-on sold separately from the base plan, off by default (see entitlements.ts's
// gdpr_feature comment). Enforcement paths (assertNotUnsubscribed) still run their DB check
// even when the feature is off for a workspace, since a Person who already unsubscribed
// under a plan that had the add-on shouldn't start getting emailed again just because the
// workspace's subscription changed — the gate controls the tracking UI and the ability to
// mark someone unsubscribed, not whether an existing unsubscribedAt is honored.
export async function isGdprModuleEnabled(workspaceId: string): Promise<boolean> {
  return hasFeatureAccess(workspaceId, "gdpr_feature");
}

export class UnsubscribedError extends Error {
  constructor() {
    super("This contact has unsubscribed. If further communication is relevant, contact the workspace owner for a resubscribe.");
    this.name = "UnsubscribedError";
  }
}

// Called from every send path (manual compose, campaigns, sequences) right before the actual
// send — same "assert right before the guarded action" pattern as assertLimit. Throws
// unconditionally once Person.unsubscribedAt is set, regardless of send method: this was a
// deliberate product decision (strict enforcement, no "but this is a 1:1 manual email"
// carve-out) since a blanket rule is far easier to defend than one with exceptions.
export async function assertNotUnsubscribed(personId: string): Promise<void> {
  const person = await db.person.findUnique({ where: { id: personId }, select: { unsubscribedAt: true } });
  if (person?.unsubscribedAt) throw new UnsubscribedError();
}

// Single write path for Person.unsubscribedAt — the public token route, the Settings > GDPR
// toggle and the per-contact toggle all route through here so the timeline entry can't be
// forgotten by one caller. Only logs on an actual state change (updateMany returns count 0
// when already in the target state), which also keeps link prefetches from spamming the
// timeline. actorId is null for the public route: the recipient isn't a workspace User.
export async function setUnsubscribed(
  personId: string,
  workspaceId: string,
  unsubscribed: boolean,
  actorId: string | null,
  // ponytail: injectable only so the test can stub it; production always uses `db`. Typed as
  // just the two calls made here rather than the full PrismaClient, so a stub stays small.
  client: {
    person: { updateMany: (args: Parameters<typeof db.person.updateMany>[0]) => Promise<{ count: number }> };
    activity: { create: (args: { data: Parameters<typeof db.activity.create>[0]["data"] }) => Promise<unknown> };
  } = db,
): Promise<void> {
  const { count } = await client.person.updateMany({
    where: { id: personId, workspaceId, unsubscribedAt: unsubscribed ? null : { not: null } },
    data: { unsubscribedAt: unsubscribed ? new Date() : null },
  });
  if (count === 0) return;

  await client.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: personId,
      kind: unsubscribed ? "unsubscribed" : "resubscribed",
      field: "Unsubscribed",
      actorId,
    },
  });
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

// HMAC-signed token, not just a raw personId — a bare id in a public unsubscribe URL would let
// anyone unsubscribe an arbitrary contact by guessing/enumerating cuids. The signature ties
// the token to this specific person; no expiry, since an unsubscribe link should keep working
// for as long as the email it was sent in is sitting in someone's inbox (could be years).
export function buildUnsubscribeToken(personId: string): string {
  const sig = createHmac("sha256", getSecret()).update(personId).digest("hex").slice(0, 32);
  return `${personId}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [personId, sig] = token.split(".");
  if (!personId || !sig) return null;

  const expected = createHmac("sha256", getSecret()).update(personId).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return personId;
}
