import { listTasksWithDueDate } from "@/lib/actions/tasks";
import { listMembers } from "@/lib/actions/members";
import { TasksView } from "@/components/tasks-view";

export default async function TasksPage() {
  const [tasks, users] = await Promise.all([listTasksWithDueDate(), listMembers()]);
  return <TasksView tasks={tasks} users={users} />;
}
