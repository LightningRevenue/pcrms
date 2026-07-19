"use server";

import { revalidatePath } from "next/cache";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/workspace-settings";

export async function getTrackingSettings() {
  const [appBaseUrl, trackingDomain] = await Promise.all([
    getSetting(SETTING_KEYS.appBaseUrl),
    getSetting(SETTING_KEYS.trackingDomain),
  ]);
  return { appBaseUrl, trackingDomain };
}

export async function saveTrackingSettings(input: { appBaseUrl: string; trackingDomain: string }) {
  await setSetting(SETTING_KEYS.appBaseUrl, input.appBaseUrl.trim().replace(/\/$/, ""));
  await setSetting(SETTING_KEYS.trackingDomain, input.trackingDomain.trim().replace(/^https?:\/\//, ""));
  revalidatePath("/settings/tracking");
}
