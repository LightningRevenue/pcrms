import { listPlaybooks } from "@/lib/actions/playbooks";
import { PlaybooksView } from "@/components/playbooks-view";

export default async function PlaybooksPage() {
  const playbooks = await listPlaybooks();

  return <PlaybooksView playbooks={playbooks} />;
}
