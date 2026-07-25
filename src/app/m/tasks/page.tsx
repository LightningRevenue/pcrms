import { listTasksWithDueDate } from "@/lib/actions/tasks";
import { MobileTasksList } from "@/components/mobile-tasks-list";

export default async function MobileTasksPage() {
  const tasks = await listTasksWithDueDate();
  return <MobileTasksList tasks={tasks} />;
}
