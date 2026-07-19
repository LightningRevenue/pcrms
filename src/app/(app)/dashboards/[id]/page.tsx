import { notFound } from "next/navigation";
import { getDashboard } from "@/lib/actions/dashboards";
import { SalesTrackingDashboard } from "@/components/sales-tracking-dashboard";

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

  notFound();
}
