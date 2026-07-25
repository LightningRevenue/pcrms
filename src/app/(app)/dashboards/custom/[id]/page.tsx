import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCustomDashboard } from "@/lib/actions/custom-dashboards";
import { listMembers } from "@/lib/actions/members";
import { CustomDashboardGrid } from "@/components/custom-dashboard-grid";

export default async function CustomDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dashboard, users] = await Promise.all([getCustomDashboard(id), listMembers()]);
  if (!dashboard) notFound();

  return (
    <div className="py-10">
      <div className="px-8">
        <Link href="/dashboards" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <ArrowLeft size={14} strokeWidth={1.75} />
          Dashboards
        </Link>
        <h1 className="text-xl font-medium mt-4">{dashboard.name}</h1>
      </div>

      <div className="mt-6">
        <CustomDashboardGrid dashboardId={dashboard.id} widgets={dashboard.widgets} users={users} />
      </div>
    </div>
  );
}
