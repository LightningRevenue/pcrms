import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { sendMagicLink } from "@/lib/magic-link";
import { ensureWorkspaceMembership, decideSignIn } from "@/lib/workspace";
import { verifyPassword } from "@/lib/password";

// Set by /invite/[token] right before redirecting into signIn("google") — read here to
// decide which Workspace/role a brand-new sign-in should land in, then cleared once used.
// See lib/workspace.ts's decideSignIn/ensureWorkspaceMembership for why this can't just be a
// callback param: Auth.js's signIn callback receives no request/cookies data (verified against
// @auth/core's actual call sites, not just its types), but next/headers' cookies() still works
// here because this callback runs inside the same request's AsyncLocalStorage context as the
// /api/auth/[...nextauth]/route.ts handler that invoked it.
export const INVITE_TOKEN_COOKIE = "invite_token";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required behind a reverse proxy (nginx) — otherwise Auth.js rejects every request with
  // UntrustedHost since it can't verify the Host header itself, and silently returns no
  // session instead of erroring loudly, which is what let unauthenticated requests through.
  trustHost: true,
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    // Magic-link sign-in for test/teammate accounts outside the workspace's Google domain —
    // gated in the signIn callback below to only known Users (added via Settings > Members).
    // `server` is required by Auth.js's config validation but never actually used — the real
    // transport (SMTP mailbox or Gmail API) is chosen dynamically inside sendMagicLink based
    // on the Settings > Email Notifications inbox.
    Nodemailer({
      server: "smtp://unused:unused@localhost:25",
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLink(identifier, url);
      },
    }),
    // Email+password login. Only handles LOGIN (verifying a password against an existing
    // User.passwordHash) — account creation happens in the /signup flow (lib/actions/signup.ts),
    // which sets passwordHash and creates the WorkspaceMember directly, since Auth.js's
    // createUser event never fires for Credentials sign-ins (only for adapter-driven OAuth/email
    // flows), so there'd be nowhere else to run that workspace-assignment logic for this provider.
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : null;
        const password = typeof raw?.password === "string" ? raw.password : null;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  // Must be "jwt", not "database" — Auth.js's Credentials provider always issues a JWT
  // regardless of this setting (its own hardcoded behavior, confirmed against @auth/core's
  // source: the credentials branch of the callback handler never calls the adapter's
  // createSession, unlike the oauth/email branches). With "database" set globally, every
  // cookie is looked up as an opaque Session-table token, so a Credentials-issued JWT is
  // never recognized and gets silently stripped — this app mixes Credentials with Google/
  // Nodemailer, which don't trigger Auth.js's own "credentials needs jwt" startup guard
  // (that guard only fires when Credentials is the ONLY provider), so it fails silently
  // instead of erroring at boot. "jwt" globally works fine for Google/Nodemailer too — the
  // Prisma adapter is still used for User/Account/VerificationToken persistence, just not
  // the Session table.
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/auth-error" },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email;
      if (!email) return false;

      // Magic-link sign-ins are for existing members only (see sendMagicLink, which refuses
      // to send a link at all for an email with no User row) — no workspace/domain decision
      // needed here, that only applies to brand-new sign-ins.
      if (account?.provider === "nodemailer") {
        const existing = await db.user.findUnique({ where: { email } });
        return !!existing;
      }

      const inviteToken = (await cookies()).get(INVITE_TOKEN_COOKIE)?.value ?? null;
      const decision = await decideSignIn(email, inviteToken);
      if (!decision.allow) {
        // Auth.js only supports redirecting to /login?error=<code> on a false/thrown signIn,
        // not a custom message — encode the reason so /login can surface it verbatim.
        return `/login?error=WorkspaceRejected&reason=${encodeURIComponent(decision.reason)}`;
      }
      return true;
    },
    // Runs at sign-in (user is set, from whichever provider) and on every subsequent session
    // read (user is undefined then — token already carries `sub` from the first run).
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    // With the "jwt" strategy this always receives `token`, never `user` — look up the same
    // WorkspaceMember row every time and attach workspaceId/role so server actions/route
    // handlers can scope queries without a second auth() round-trip.
    async session({ session, token }) {
      const userId = token?.sub;
      if (!userId) return session;

      const [membership, user] = await Promise.all([
        db.workspaceMember.findUnique({
          where: { userId },
          select: { workspaceId: true, role: true, workspace: { select: { name: true } } },
        }),
        db.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } }),
      ]);
      if (membership) {
        session.user.workspaceId = membership.workspaceId;
        session.user.workspaceName = membership.workspace.name;
        session.user.role = membership.role;
      }
      session.user.isPlatformAdmin = user?.isPlatformAdmin ?? false;
      session.user.id = userId;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!account || account.provider !== "google") return;
      await db.account.update({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: account.access_token,
          refresh_token: account.refresh_token ?? undefined,
          expires_at: account.expires_at,
          scope: account.scope,
          token_type: account.token_type,
          id_token: account.id_token,
        },
      });
    },
    // Fires once, right after the Prisma adapter creates a brand-new User row (never for a
    // returning user). At this point signIn() already allowed the sign-in through — this just
    // has to figure out (or create) the Workspace to attach them to, then consume the invite
    // (if any) for real, now that we have a durable User row to attach the membership to.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const inviteToken = (await cookies()).get(INVITE_TOKEN_COOKIE)?.value ?? null;
      await ensureWorkspaceMembership(user.id, user.email, inviteToken);
      if (inviteToken) (await cookies()).delete(INVITE_TOKEN_COOKIE);
    },
  },
});
