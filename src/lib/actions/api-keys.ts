"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceOwner, requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { generateApiKeyToken } from "@/lib/api-key";

export async function listApiKeys() {
  const { workspaceId } = await requireWorkspace();
  return db.apiKey.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export async function createApiKey(name: string) {
  const { userId, workspaceId } = await requireWorkspaceOwner();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const { token, tokenHash, tokenLast4 } = generateApiKeyToken();
  await db.apiKey.create({
    data: { workspaceId, name: trimmed, tokenHash, tokenLast4, createdById: userId },
  });

  revalidatePath("/settings/mcp-apis");
  return token; // shown once, never stored
}

export async function revokeApiKey(id: string) {
  const { workspaceId } = await requireWorkspaceOwner();
  await db.apiKey.deleteMany({ where: { id, workspaceId } });
  revalidatePath("/settings/mcp-apis");
}
