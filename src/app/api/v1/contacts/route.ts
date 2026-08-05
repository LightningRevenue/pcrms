import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";
import { assertLimit } from "@/lib/entitlements";
import { deriveJobTitleFields } from "@/lib/job-title";
import { queueHistoryBackfill } from "@/lib/queue-history-backfill";

// "Contact" is the public-API name for what the rest of the codebase models as Person.
export async function POST(req: Request) {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireApiKey(req));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const firstName = body?.firstName?.trim();
  if (!firstName) return NextResponse.json({ error: "firstName is required" }, { status: 400 });

  if (body.companyId) {
    const company = await db.company.findFirst({ where: { id: body.companyId, workspaceId } });
    if (!company) return NextResponse.json({ error: "companyId not found in this workspace" }, { status: 400 });
  }

  // Same plan cap the server actions enforce — without this the API is an unmetered path
  // around every count limit.
  try {
    await assertLimit(workspaceId, "contacts_count");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 402 });
  }

  const jobTitle = body.jobTitle?.trim() || null;

  const person = await db.person.create({
    data: {
      workspaceId,
      firstName,
      lastName: body.lastName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      jobTitle,
      ...deriveJobTitleFields(jobTitle),
      linkedin: body.linkedin?.trim() || null,
      companyId: body.companyId || null,
    },
  });

  if (person.email) await queueHistoryBackfill(person.id, workspaceId);

  return NextResponse.json(person, { status: 201 });
}
