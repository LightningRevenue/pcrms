// Plain sync helper, deliberately not in twilio.ts — that file has "use server",
// which requires every export to be an async Server Action.
export function isVoiceReady(
  account: { apiKeySid: string | null; apiKeySecret: string | null; twimlAppSid: string | null } | null
) {
  return !!(account?.apiKeySid && account.apiKeySecret && account.twimlAppSid);
}
