import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { listDashboards } from "@/lib/actions/dashboards";

export default async function DashboardsPage() {
  const dashboards = await listDashboards();

  return (
    <div className="px-8 py-10 max-w-2xl">
      <h1 className="text-xl font-medium">Dashboards</h1>
      <p className="text-[13px] text-subtle mt-1">Reporting views across your workspace.</p>

      <div className="mt-6 border border-border rounded-md overflow-hidden">
        {dashboards.map((d) => (
          <Link
            key={d.id}
            href={`/dashboards/${d.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-b-0"
          >
            <LayoutGrid size={16} strokeWidth={1.5} className="text-subtle shrink-0" />
            <span className="text-[13px]">{d.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
