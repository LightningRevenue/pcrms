import { db } from "@/lib/db";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";
import { MobileContactsList } from "@/components/mobile-contacts-list";

export default async function MobileContactsPage() {
  const ctx = await requireWorkspace();
  const people = await db.person.findMany({
    where: { workspaceId: ctx.workspaceId, ...personVisibilityFilter(ctx) },
    orderBy: { createdAt: "desc" },
    include: { company: true },
  });

  return <MobileContactsList people={people} />;
}
