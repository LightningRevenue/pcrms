"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const TWILIO_ACCOUNT_ID = "default";

export async function getTwilioAccount() {
  return db.twilioAccount.findUnique({ where: { id: TWILIO_ACCOUNT_ID } });
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const accountSid = input.accountSid.trim();
  const authToken = input.authToken.trim();
  const phoneNumber = input.phoneNumber.trim();
  const apiKeySid = input.apiKeySid.trim();
  const apiKeySecret = input.apiKeySecret.trim();
  const twimlAppSid = input.twimlAppSid.trim();
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Account SID, Auth Token, and phone number are required");
  }

  const account = await db.twilioAccount.upsert({
    where: { id: TWILIO_ACCOUNT_ID },
    create: {
      id: TWILIO_ACCOUNT_ID,
      accountSid,
      authToken,
      phoneNumber,
      apiKeySid: apiKeySid || null,
      apiKeySecret: apiKeySecret || null,
      twimlAppSid: twimlAppSid || null,
      updatedById: session.user.id,
    },
    update: {
      accountSid,
      authToken,
      phoneNumber,
      apiKeySid: apiKeySid || null,
      apiKeySecret: apiKeySecret || null,
      twimlAppSid: twimlAppSid || null,
      updatedById: session.user.id,
    },
  });

  revalidatePath("/settings/accounts/twilio");
  return account;
}

export async function deleteTwilioAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.twilioAccount.deleteMany({ where: { id: TWILIO_ACCOUNT_ID } });
  revalidatePath("/settings/accounts/twilio");
}
