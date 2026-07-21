import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { MembersManager } from "@/components/members-manager";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { listMembers, listPendingInvites } from "@/lib/actions/members";

export default async function MembersPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Members"]} requiredRole="owner" />;
  }

  const [members, invites] = await Promise.all([listMembers(), listPendingInvites()]);

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Members"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Members</h1>
        <p className="text-[13px] text-subtle mt-1">
          Invite teammates by email — they'll get a link to sign in and join this workspace directly.
        </p>

        <MembersManager members={members} invites={invites} />
      </div>
    </>
  );
}
