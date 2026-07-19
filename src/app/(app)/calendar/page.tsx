import { CalendarView } from "@/components/calendar-view";
import { listTasksWithDueDate } from "@/lib/actions/tasks";

export default async function CalendarPage() {
  const tasks = await listTasksWithDueDate();
  return <CalendarView tasks={tasks} />;
}
