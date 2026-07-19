import { SettingsHeader } from "@/components/settings-header";
import { MembersManager } from "@/components/members-manager";
import { listMembers } from "@/lib/actions/members";

export default async function MembersPage() {
  const members = await listMembers();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Members"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Members</h1>
        <p className="text-[13px] text-subtle mt-1">
          Members added here can sign in with a magic link sent to their email, regardless of domain — useful for
          teammates or test accounts outside the workspace's Google domain.
        </p>

        <MembersManager members={members} />
      </div>
    </>
  );
}
