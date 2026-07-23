import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getCustomReport, runCustomReport } from "@/lib/actions/custom-reports";
import { getEntityDef } from "@/lib/custom-report-registry";
import type { ReportEntity, CustomReportFilter } from "@/lib/custom-report-registry";
import type { Aggregate, Display } from "@/lib/actions/custom-reports";
import { ReportResultViewWithDrilldown } from "@/components/report-result-view";

export default async function CustomReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getCustomReport(id);
  if (!report) notFound();

  const entity = report.entity as ReportEntity;
  const filters = report.filters as unknown as CustomReportFilter[];
  const aggregate = report.aggregate as Aggregate;
  const display = report.display as Display;

  const result = await runCustomReport({ entity, filters, groupBy: report.groupBy, aggregate });

  return (
    <div className="px-8 py-10 max-w-3xl">
      <Link href="/dashboards" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Dashboards
      </Link>

      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-xl font-medium">{report.name}</h1>
          <p className="text-[13px] text-subtle mt-1">{getEntityDef(entity).labelPlural}</p>
        </div>
        <Link
          href={`/dashboards/report/${report.id}/edit`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          <Pencil size={13} strokeWidth={1.75} />
          Edit
        </Link>
      </div>

      <div className="mt-6">
        <ReportResultViewWithDrilldown result={result} display={display} entity={entity} filters={filters} groupBy={report.groupBy} />
      </div>
    </div>
  );
}
