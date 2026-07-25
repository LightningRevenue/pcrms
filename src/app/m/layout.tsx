import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthSessionProvider } from "@/components/session-provider";
import { requireWorkspace, hasCompletedOnboarding } from "@/lib/workspace";
import { MobileNav } from "@/components/mobile-nav";

export const dynamic = "force-dynamic";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
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
      <div className="min-h-full flex flex-col">
        <main className="flex-1 min-w-0 pb-16">{children}</main>
        <MobileNav />
      </div>
    </AuthSessionProvider>
  );
}
