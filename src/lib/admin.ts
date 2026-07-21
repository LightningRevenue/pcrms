import { auth } from "@/lib/auth";

// Completely separate from requireWorkspace()/requireWorkspaceOwner() — a platform admin
// isn't necessarily a WorkspaceMember of anything. Gates /admin and its server actions only.
export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (!session.user.isPlatformAdmin) throw new Error("Not authorized");
  return { userId: session.user.id };
}
