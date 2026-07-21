import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSequence } from "@/lib/actions/sequences";
import { listTemplates } from "@/lib/actions/emails";
import { listTemplateVariables } from "@/lib/template-variables";
import { SequenceDetailView } from "@/components/sequence-detail-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access sequences. Contact your workspace owner if you need access." />;
  }

  const [sequence, templates, variables] = await Promise.all([
    getSequence(id),
    listTemplates(),
    listTemplateVariables(),
  ]);

  if (!sequence) notFound();

  return <SequenceDetailView sequence={sequence} templates={templates} variables={variables} />;
}
