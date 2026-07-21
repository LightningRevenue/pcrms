import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin";
import { getWorkspaceForAdmin } from "@/lib/actions/admin";
import { WorkspaceAdminActions } from "@/components/workspace-admin-actions";
import { WorkspacePlanSelect } from "@/components/workspace-plan-select";

export default async function AdminWorkspaceDetailPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  await requirePlatformAdmin();
  const { workspaceId } = await params;
  const { workspace, usage, plans } = await getWorkspaceForAdmin(workspaceId);

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        All workspaces
      </Link>

      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-xl font-medium">{workspace.name}</h1>
          <p className="text-[13px] text-subtle mt-1">{workspace.emailDomain}</p>
        </div>
        <div className="flex items-center gap-2">
          <WorkspacePlanSelect workspaceId={workspace.id} planId={workspace.planId} plans={plans} />
          <WorkspaceAdminActions workspaceId={workspace.id} suspended={!!workspace.suspendedAt} />
        </div>
      </div>

      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mt-8">Usage</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div className="border border-border rounded-md p-3">
          <p className="text-[20px] font-medium">{usage.companyCount}</p>
          <p className="text-[12px] text-subtle">Companies</p>
        </div>
        <div className="border border-border rounded-md p-3">
          <p className="text-[20px] font-medium">{usage.personCount}</p>
          <p className="text-[12px] text-subtle">Contacts</p>
        </div>
        <div className="border border-border rounded-md p-3">
          <p className="text-[20px] font-medium">{usage.opportunityCount}</p>
          <p className="text-[12px] text-subtle">Deals</p>
        </div>
      </div>

      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mt-8">Members</p>
      <div className="mt-2 border border-border rounded-md overflow-hidden">
        {workspace.members.map((m) => (
          <div key={m.user.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.user.name || "Unnamed"}</div>
              <div className="text-subtle text-[12px] truncate">{m.user.email}</div>
            </div>
            <span className="text-[11px] text-subtle capitalize shrink-0">{m.role}</span>
            {!m.onboardedAt && (
              <span className="text-[11px] text-subtle shrink-0">(not onboarded)</span>
            )}
          </div>
        ))}
        {workspace.members.length === 0 && (
          <div className="px-3 py-4 text-[13px] text-subtle text-center">No members</div>
        )}
      </div>
    </div>
  );
}
