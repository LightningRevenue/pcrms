import { db } from "@/lib/db";
import { EmailTemplatesView } from "@/components/email-templates-view";

export default async function EmailTemplatesPage() {
  const templates = await db.emailTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: true },
  });

  return <EmailTemplatesView templates={templates} />;
}
