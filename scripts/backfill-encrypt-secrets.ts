import "dotenv/config";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

// One-time backfill: MailboxAccount.password / TwilioAccount.authToken predate
// encryption-at-rest and are stored as plaintext. Encrypt any value that isn't
// already in the "iv:authTag:ciphertext" hex format the app now expects.
function looksEncrypted(value: string) {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

async function main() {
  const mailboxes = await db.mailboxAccount.findMany({ select: { id: true, password: true } });
  let mailboxCount = 0;
  for (const m of mailboxes) {
    if (looksEncrypted(m.password)) continue;
    await db.mailboxAccount.update({ where: { id: m.id }, data: { password: encrypt(m.password) } });
    mailboxCount++;
  }

  const twilioAccounts = await db.twilioAccount.findMany({ select: { id: true, authToken: true } });
  let twilioCount = 0;
  for (const t of twilioAccounts) {
    if (looksEncrypted(t.authToken)) continue;
    await db.twilioAccount.update({ where: { id: t.id }, data: { authToken: encrypt(t.authToken) } });
    twilioCount++;
  }

  console.log(`Encrypted ${mailboxCount}/${mailboxes.length} mailbox passwords, ${twilioCount}/${twilioAccounts.length} Twilio tokens.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
