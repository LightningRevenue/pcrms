import { ListsView } from "@/components/lists-view";
import { listLists } from "@/lib/actions/lists";

export default async function ListsPage() {
  const lists = await listLists();
  return <ListsView lists={lists} />;
}
