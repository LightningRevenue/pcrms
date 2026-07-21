import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      workspaceId?: string;
      workspaceName?: string;
      role?: string;
      isPlatformAdmin?: boolean;
    } & DefaultSession["user"];
  }
}
