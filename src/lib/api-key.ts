import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";

const PREFIX = "crm_";

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Plaintext token is only ever returned here, at creation — the DB keeps just its hash.
export function generateApiKeyToken() {
  const token = PREFIX + randomBytes(24).toString("hex");
  return { token, tokenHash: hash(token), tokenLast4: token.slice(-4) };
}

// Auth entry point for the public REST API (Settings > MCP & APIs) — mirrors requireWorkspace's
// role as the single gate, but for "Authorization: Bearer <token>" callers instead of a session.
export async function requireApiKey(req: Request): Promise<{ workspaceId: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("Missing Authorization: Bearer <token> header");

  const key = await db.apiKey.findUnique({ where: { tokenHash: hash(token) } });
  if (!key) throw new Error("Invalid API key");

  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { workspaceId: key.workspaceId };
}
