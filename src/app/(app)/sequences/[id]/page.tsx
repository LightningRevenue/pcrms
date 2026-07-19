import { notFound } from "next/navigation";
import { getSequence } from "@/lib/actions/sequences";
import { listTemplates } from "@/lib/actions/emails";
import { listTemplateVariables } from "@/lib/template-variables";
import { SequenceDetailView } from "@/components/sequence-detail-view";

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [sequence, templates, variables] = await Promise.all([
    getSequence(id),
    listTemplates(),
    listTemplateVariables(),
  ]);

  if (!sequence) notFound();

  return <SequenceDetailView sequence={sequence} templates={templates} variables={variables} />;
}
