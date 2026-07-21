import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmailTemplatesView } from "@/components/email-templates-view";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { requireWorkspace } from "@/lib/workspace";

export default async function EmailTemplatesPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Resources", "Email Templates"]} requiredRole="admin" />;
  }

  const { workspaceId } = await requireWorkspace();

  const templates = await db.emailTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true },
  });

  return <EmailTemplatesView templates={templates} />;
}
