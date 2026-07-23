import { ReportBuilder } from "@/components/report-builder";
import { listMembers } from "@/lib/actions/members";

export default async function NewCustomReportPage() {
  const users = await listMembers();
  return <ReportBuilder users={users} />;
}
