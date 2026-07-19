import { PlusCircle, Pencil, ArrowRightLeft, CheckSquare, Mail, UserMinus, StickyNote } from "lucide-react";

const ICONS: Record<string, typeof PlusCircle> = {
  created: PlusCircle,
  opportunity_created: PlusCircle,
  stage_changed: ArrowRightLeft,
  task_created: CheckSquare,
  task_completed: CheckSquare,
  email_sent: Mail,
  note_added: StickyNote,
  person_removed: UserMinus,
  company_removed: UserMinus,
};

export function ActivityIcon({ kind }: { kind: string }) {
  const Icon = ICONS[kind] ?? Pencil;
  return <Icon size={15} strokeWidth={1.75} className="text-subtle shrink-0 mt-0.5" />;
}
