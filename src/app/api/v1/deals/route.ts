import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";
import { assertLimit } from "@/lib/entitlements";

// "Deal" is the public-API name for Opportunity (see Opportunity in schema.prisma).
export async function POST(req: Request) {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireApiKey(req));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  if (body.companyId) {
    const company = await db.company.findFirst({ where: { id: body.companyId, workspaceId } });
    if (!company) return NextResponse.json({ error: "companyId not found in this workspace" }, { status: 400 });
  }
  if (body.contactId) {
    const contact = await db.person.findFirst({ where: { id: body.contactId, workspaceId } });
    if (!contact) return NextResponse.json({ error: "contactId not found in this workspace" }, { status: 400 });
  }

  // Same plan cap the server actions enforce — without this the API is an unmetered path
  // around every count limit.
  try {
    await assertLimit(workspaceId, "deals_count");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 402 });
  }

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId,
      name,
      value: Number.isFinite(body.value) ? Math.trunc(body.value) : 0,
      stage: body.stage?.trim() || "New",
      companyId: body.companyId || null,
      contactId: body.contactId || null,
    },
  });

  return NextResponse.json(opportunity, { status: 201 });
}
