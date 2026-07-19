import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getConnectedGoogleAccount() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await db.account.findFirst({
    where: { userId: session.user.id, provider: "google" },
  });
  if (!account) return null;

  const scopes = account.scope?.split(" ") ?? [];
  return {
    email: session.user.email,
    gmailConnected: scopes.some((s) => s.includes("gmail")),
    calendarConnected: scopes.some((s) => s.includes("calendar")),
  };
}
