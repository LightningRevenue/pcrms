"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

// Decrypts authToken before returning — callers need the real value (Twilio REST calls in
// calls.ts/recordings route) or show it in the Settings form for the owner to view/edit,
// same as before encryption was added. Encryption only protects the value at rest in the DB.
export async function getTwilioAccount() {
  const { workspaceId } = await requireWorkspace();
  const account = await db.twilioAccount.findUnique({ where: { workspaceId } });
  if (!account) return null;
  return { ...account, authToken: decrypt(account.authToken) };
}

export type TwilioAccountInput = {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
};

export async function saveTwilioAccount(input: TwilioAccountInput) {
  const { userId, workspaceId } = await requireWorkspace();

  const accountSid = input.accountSid.trim();
  const authToken = input.authToken.trim();
  const phoneNumber = input.phoneNumber.trim();
  const apiKeySid = input.apiKeySid.trim();
  const apiKeySecret = input.apiKeySecret.trim();
  const twimlAppSid = input.twimlAppSid.trim();
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Account SID, Auth Token, and phone number are required");
  }

  const encryptedAuthToken = encrypt(authToken);
  const account = await db.twilioAccount.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      accountSid,
      authToken: encryptedAuthToken,
      phoneNumber,
      apiKeySid: apiKeySid || null,
      apiKeySecret: apiKeySecret || null,
      twimlAppSid: twimlAppSid || null,
      updatedById: userId,
    },
    update: {
      accountSid,
      authToken: encryptedAuthToken,
      phoneNumber,
      apiKeySid: apiKeySid || null,
      apiKeySecret: apiKeySecret || null,
      twimlAppSid: twimlAppSid || null,
      updatedById: userId,
    },
  });

  revalidatePath("/settings/accounts/twilio");
  return { ...account, authToken };
}

export async function deleteTwilioAccount() {
  const { workspaceId } = await requireWorkspace();

  await db.twilioAccount.deleteMany({ where: { workspaceId } });
  revalidatePath("/settings/accounts/twilio");
}
