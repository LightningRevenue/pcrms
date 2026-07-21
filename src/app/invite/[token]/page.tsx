import { db } from "@/lib/db";
import { acceptInviteAndSignIn } from "@/lib/actions/accept-invite";
import { InviteSignupForm } from "@/components/invite-signup-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.workspaceInvite.findUnique({
    where: { token },
    include: { workspace: { select: { name: true } } },
  });

  const invalid = !invite || invite.acceptedAt || invite.expiresAt < new Date();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm px-8 py-10 border border-border rounded-lg text-center">
        {invalid ? (
          <>
            <h1 className="text-xl font-medium mb-1">Invite not found</h1>
            <p className="text-[13px] text-subtle">
              This invite link is invalid, already used, or has expired. Ask whoever invited you to send a new one.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-medium mb-1">Join {invite.workspace.name}</h1>
            <p className="text-[13px] text-subtle mb-8">
              You've been invited to join as {invite.role === "owner" ? "an owner" : "a member"}.
            </p>
            <form
              action={async () => {
                "use server";
                await acceptInviteAndSignIn(token);
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.31 14.32A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.58.38-2.32V6.59H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.41l4.01-3.09Z" />
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.59l4.01 3.09C6.25 6.87 8.89 4.77 12 4.77Z" />
                </svg>
                Continue with Google
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-subtle">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <InviteSignupForm token={token} email={invite.email} />
          </>
        )}
      </div>
    </div>
  );
}
