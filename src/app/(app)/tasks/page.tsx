import { listTasksWithDueDate } from "@/lib/actions/tasks";
import { TasksView } from "@/components/tasks-view";

export default async function TasksPage() {
  const tasks = await listTasksWithDueDate();
  return <TasksView tasks={tasks} />;
}
