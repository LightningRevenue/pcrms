import { notFound } from "next/navigation";
import { getDashboard } from "@/lib/actions/dashboards";
import { SalesTrackingDashboard } from "@/components/sales-tracking-dashboard";
import { PipelineFunnelDashboard } from "@/components/pipeline-funnel-dashboard";
import { SequencePerformanceDashboard } from "@/components/sequence-performance-dashboard";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dashboard = await getDashboard(id);
  if (!dashboard) notFound();

  if (dashboard.kind === "sales-tracking") {
    return <SalesTrackingDashboard name={dashboard.name} />;
  }

  if (dashboard.kind === "pipeline-funnel") {
    return <PipelineFunnelDashboard name={dashboard.name} />;
  }

  if (dashboard.kind === "sequence-performance") {
    return <SequencePerformanceDashboard name={dashboard.name} />;
  }

  notFound();
}
