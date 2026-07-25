import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";
import { MobileContactDetail } from "@/components/mobile-contact-detail";

export default async function MobileContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const [contact, tasks, notes, calls] = await Promise.all([
    db.person.findUnique({
      where: { id, workspaceId, ...personVisibilityFilter(ctx) },
      include: { company: true },
    }),
    db.task.findMany({
      where: { workspaceId, personId: id },
      orderBy: [{ done: "asc" }, { dueAt: "asc" }],
    }),
    db.note.findMany({
      where: { workspaceId, personId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: true },
    }),
    db.call.findMany({
      where: { workspaceId, personId: id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  if (!contact) notFound();

  return <MobileContactDetail contact={contact} tasks={tasks} notes={notes} calls={calls} />;
}
