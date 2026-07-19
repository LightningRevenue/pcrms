import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { SETTING_KEYS, getSetting, setSetting } from "@/lib/workspace-settings";
import { sendMagicLink } from "@/lib/magic-link";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const { handlers, signIn, signOut, auth } = NextAuth({
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
  ],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email;
      if (!email) return false;

      // Magic-link sign-ins are for teammates/test accounts added manually via Settings >
      // Members — deliberately outside the workspace's Google domain allowlist. The only gate
      // here is "does this User already exist"; no domain check, no auto-creation.
      if (account?.provider === "nodemailer") {
        const existing = await db.user.findUnique({ where: { email } });
        return !!existing;
      }

      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain) return false;

      const allowedDomain = await getSetting(SETTING_KEYS.allowedEmailDomain);
      if (!allowedDomain) {
        const userCount = await db.user.count();
        if (userCount === 0) {
          await setSetting(SETTING_KEYS.allowedEmailDomain, domain);
          return true;
        }
        // Workspace already has members but somehow no domain was ever recorded —
        // don't silently let a new domain in; require it to be set explicitly.
        return false;
      }

      return domain === allowedDomain;
    },
  },
  events: {
    async signIn({ account }) {
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
  },
});
