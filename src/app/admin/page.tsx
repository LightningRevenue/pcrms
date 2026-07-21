import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { listWorkspacesForAdmin } from "@/lib/actions/admin";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const workspaces = await listWorkspacesForAdmin();

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Workspaces</h1>
          <p className="text-[13px] text-subtle mt-1">All workspaces on the platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/plans"
            className="px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
          >
            Plans
          </Link>
          <Link
            href="/admin/queues"
            className="px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
          >
            Background jobs
          </Link>
        </div>
      </div>

      <div className="mt-6 border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_100px_140px_100px] gap-3 px-3 py-2 border-b border-border text-[11px] font-medium text-subtle">
          <span>Name</span>
          <span>Domain</span>
          <span>Members</span>
          <span>Created</span>
          <span>Status</span>
        </div>
        {workspaces.map((w) => (
          <Link
            key={w.id}
            href={`/admin/${w.id}`}
            className="grid grid-cols-[1fr_1fr_100px_140px_100px] gap-3 px-3 py-2.5 items-center text-[13px] border-b border-border last:border-b-0 hover:bg-muted transition-colors"
          >
            <span className="truncate font-medium">{w.name}</span>
            <span className="truncate text-subtle">{w.emailDomain}</span>
            <span className="text-subtle">{w._count.members}</span>
            <span className="text-subtle">{w.createdAt.toLocaleDateString()}</span>
            <span>
              {w.suspendedAt ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 text-[11px]">
                  Suspended
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[11px]">
                  Active
                </span>
              )}
            </span>
          </Link>
        ))}
        {workspaces.length === 0 && (
          <div className="px-3 py-4 text-[13px] text-subtle text-center">No workspaces yet</div>
        )}
      </div>
    </div>
  );
}
