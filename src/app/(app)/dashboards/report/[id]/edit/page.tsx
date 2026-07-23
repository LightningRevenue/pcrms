import { notFound } from "next/navigation";
import { getCustomReport } from "@/lib/actions/custom-reports";
import { listMembers } from "@/lib/actions/members";
import { ReportBuilder } from "@/components/report-builder";
import type { ReportEntity, CustomReportFilter } from "@/lib/custom-report-registry";
import type { Aggregate, Display } from "@/lib/actions/custom-reports";

export default async function EditCustomReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, users] = await Promise.all([getCustomReport(id), listMembers()]);
  if (!report) notFound();

  return (
    <ReportBuilder
      users={users}
      existing={{
        id: report.id,
        name: report.name,
        entity: report.entity as ReportEntity,
        filters: report.filters as unknown as CustomReportFilter[],
        groupBy: report.groupBy,
        aggregate: report.aggregate as Aggregate,
        display: report.display as Display,
      }}
    />
  );
}
