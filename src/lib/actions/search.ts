"use server";

import { db } from "@/lib/db";

export type WorkspaceSearchResult = {
  id: string;
  kind: "company" | "person";
  label: string;
  sublabel: string;
  href: string;
};

export async function searchWorkspace(query: string): Promise<WorkspaceSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const [companies, people] = await Promise.all([
    db.company.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: 10,
      select: { id: true, name: true, domain: true },
    }),
    db.person.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { firstName: "asc" },
      take: 10,
      select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
    }),
  ]);

  const companyResults: WorkspaceSearchResult[] = companies.map((c) => ({
    id: c.id,
    kind: "company",
    label: c.name,
    sublabel: c.domain ?? "",
    href: `/companies/${c.id}`,
  }));

  const personResults: WorkspaceSearchResult[] = people.map((p) => ({
    id: p.id,
    kind: "person",
    label: [p.firstName, p.lastName].filter(Boolean).join(" "),
    sublabel: p.company?.name ?? p.email ?? "",
    href: `/contacts/${p.id}`,
  }));

  return [...companyResults, ...personResults];
}
