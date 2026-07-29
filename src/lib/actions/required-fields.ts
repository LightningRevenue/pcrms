"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, requireWorkspaceOwner } from "@/lib/workspace";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/workspace-settings";
import {
  parseRequiredFields,
  serializeRequiredFields,
  type RequiredFieldsConfig,
} from "@/lib/required-fields";

// Readable by any member — the New Person panel and the import mapping screen both need it to
// render, not just owners.
export async function getRequiredPersonFields(): Promise<RequiredFieldsConfig> {
  const { workspaceId } = await requireWorkspace();
  return parseRequiredFields(await getSetting(SETTING_KEYS.requiredPersonFields, workspaceId));
}

export async function setRequiredPersonFields(config: RequiredFieldsConfig) {
  const { workspaceId } = await requireWorkspaceOwner();
  await setSetting(SETTING_KEYS.requiredPersonFields, serializeRequiredFields(config), workspaceId);

  revalidatePath("/settings/required-fields");
  revalidatePath("/contacts");
}
