import { SequencesView } from "@/components/sequences-view";
import { listSequences } from "@/lib/actions/sequences";

export default async function SequencesPage() {
  const sequences = await listSequences();
  return <SequencesView sequences={sequences} />;
}
