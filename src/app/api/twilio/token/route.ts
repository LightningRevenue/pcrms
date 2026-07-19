import { NextResponse } from "next/server";
import twilio from "twilio";
import { auth } from "@/lib/auth";
import { getTwilioAccount } from "@/lib/actions/twilio";
import { isVoiceReady } from "@/lib/twilio-helpers";

// Excluded from the auth proxy matcher along with the rest of /api/twilio (Twilio's own
// webhooks have no session cookie), so this route checks the session itself instead.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const account = await getTwilioAccount();
  if (!account || !isVoiceReady(account)) {
    return NextResponse.json({ error: "Twilio Voice is not configured" }, { status: 400 });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(account.accountSid, account.apiKeySid!, account.apiKeySecret!, {
    identity: session.user.id,
    ttl: 3600,
  });
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: account.twimlAppSid!,
      incomingAllow: false,
    })
  );

  return NextResponse.json({ token: token.toJwt(), identity: session.user.id });
}
