import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key";
import { assertLimit } from "@/lib/entitlements";
import { deriveRevenueRange, parseEmployeeCountInput } from "@/lib/firmographics";

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

  // Same plan cap the server actions enforce — without this the API is an unmetered path
  // around every count limit.
  try {
    await assertLimit(workspaceId, "companies_count");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 402 });
  }

  const company = await db.company.create({
    data: {
      workspaceId,
      name,
      domain: body.domain?.trim() || null,
      address: body.address?.trim() || null,
      linkedin: body.linkedin?.trim() || null,
      annualRevenue: body.annualRevenue?.trim() || null,
      industry: body.industry?.trim() || null,
      country: body.country?.trim() || null,
      // Explicit range wins; otherwise derived from annualRevenue, same as the UI and import.
      revenueRange: body.revenueRange?.trim() || deriveRevenueRange(body.annualRevenue),
      employeeCount: parseEmployeeCountInput(body.employeeCount),
    },
  });

  return NextResponse.json(company, { status: 201 });
}
