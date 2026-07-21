import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { AuthSessionProvider } from "@/components/session-provider";
import { requireWorkspace, hasCompletedOnboarding } from "@/lib/workspace";

// Every page in this group is behind auth (enforced in src/proxy.ts), but without a
// server-side per-request signal here Next.js was prerendering pages like /dashboards,
// /companies, /calendar etc. as static HTML at build time — served straight from cache,
// bypassing the middleware's session check on every subsequent request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Checked separately from requireWorkspace() (which also throws on suspension) so a
  // suspended workspace gets a clear "/suspended" redirect here instead of an unhandled
  // 500 from the layout — requireWorkspace()'s throw is still the safety net every server
  // action goes through.
  const session = await auth();
  if (session?.user?.workspaceId) {
    const workspace = await db.workspace.findUnique({
      where: { id: session.user.workspaceId },
      select: { suspendedAt: true },
    });
    if (workspace?.suspendedAt) redirect("/suspended");
  }

  const { userId } = await requireWorkspace();
  if (!(await hasCompletedOnboarding(userId))) redirect("/onboarding");

  return (
    <AuthSessionProvider>
      <div className="min-h-full flex">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
