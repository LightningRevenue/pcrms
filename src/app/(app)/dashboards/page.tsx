import Link from "next/link";
import { LayoutGrid, BarChart3, Plus } from "lucide-react";
import { listDashboards } from "@/lib/actions/dashboards";
import { listCustomReports } from "@/lib/actions/custom-reports";
import { getEntityDef } from "@/lib/custom-report-registry";
import type { ReportEntity } from "@/lib/custom-report-registry";

export default async function DashboardsPage() {
  const [dashboards, customReports] = await Promise.all([listDashboards(), listCustomReports()]);

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

      <div className="flex items-center justify-between mt-10">
        <div>
          <h2 className="text-[15px] font-medium">Custom reports</h2>
          <p className="text-[12px] text-subtle mt-0.5">Build your own — pick an entity, filter it, group it.</p>
        </div>
        <Link
          href="/dashboards/report/new"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          New report
        </Link>
      </div>

      <div className="mt-3 border border-border rounded-md overflow-hidden">
        {customReports.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-subtle">No custom reports yet.</div>
        ) : (
          customReports.map((r) => (
            <Link
              key={r.id}
              href={`/dashboards/report/${r.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-b-0"
            >
              <BarChart3 size={16} strokeWidth={1.5} className="text-subtle shrink-0" />
              <span className="text-[13px] flex-1 min-w-0 truncate">{r.name}</span>
              <span className="text-[11px] text-subtle shrink-0">{getEntityDef(r.entity as ReportEntity).labelPlural}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
