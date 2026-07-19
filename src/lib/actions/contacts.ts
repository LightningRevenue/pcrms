"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deriveCompanyNameFromEmail } from "@/lib/company-from-email";
import { PERSON_FIELD_LABELS } from "@/lib/field-labels";

export type CreateContactInput = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  linkedin?: string;
};

const FIELD_LABELS = PERSON_FIELD_LABELS;

export type PersonField = keyof typeof FIELD_LABELS;

async function resolveCompanyId(name: string, domain?: string | null) {
  const company =
    (await db.company.findFirst({ where: { name } })) ??
    (await db.company.create({ data: { name, domain: domain || null } }));
  return company.id;
}

export async function createContact(input: CreateContactInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const firstName = input.firstName.trim();
  if (!firstName) throw new Error("First name is required");

  const email = input.email?.trim() || null;
  const companyName = input.company?.trim() || (email ? deriveCompanyNameFromEmail(email) : null);
  const emailDomain = email && !input.company?.trim() ? email.split("@")[1]?.toLowerCase().trim() : null;
  const companyId = companyName ? await resolveCompanyId(companyName, emailDomain) : undefined;

  const person = await db.person.create({
    data: {
      firstName,
      lastName: input.lastName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      jobTitle: input.jobTitle?.trim() || null,
      linkedin: input.linkedin?.trim() || null,
      companyId,
      createdById: session.user.id,
    },
  });

  await db.activity.create({
    data: { entityType: "person", entityId: person.id, kind: "created", actorId: session.user.id },
  });

  revalidatePath("/contacts");
}

export async function deleteContacts(ids: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (ids.length === 0) return { deleted: 0, skipped: 0 };

  const blocked = await db.opportunity.findMany({
    where: { contactId: { in: ids } },
    select: { contactId: true },
    distinct: ["contactId"],
  });
  const blockedIds = new Set(blocked.map((o) => o.contactId));

  const deletable = ids.filter((id) => !blockedIds.has(id));

  const people = await db.person.findMany({
    where: { id: { in: deletable } },
    select: { id: true, firstName: true, lastName: true, companyId: true },
  });

  const { count } = await db.person.deleteMany({ where: { id: { in: deletable } } });

  await Promise.all(
    people
      .filter((p) => p.companyId)
      .map((p) =>
        db.activity.create({
          data: {
            entityType: "company",
            entityId: p.companyId!,
            kind: "person_removed",
            field: "Person",
            oldValue: [p.firstName, p.lastName].filter(Boolean).join(" "),
            actorId: session.user!.id,
          },
        })
      )
  );

  revalidatePath("/contacts");
  return { deleted: count, skipped: ids.length - deletable.length };
}

export async function searchPeople(query: string) {
  const q = query.trim();
  if (!q) return [];
  const people = await db.person.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { firstName: "asc" },
    take: 8,
    select: { id: true, firstName: true, lastName: true },
  });
  return people.map((p) => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(" ") }));
}

export async function setPersonOwner(personId: string, ownerId: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const current = await db.person.findUniqueOrThrow({ where: { id: personId }, include: { owner: true } });
  const oldValue = current.owner?.name ?? current.owner?.email ?? "";

  const next = ownerId ? await db.user.findUniqueOrThrow({ where: { id: ownerId } }) : null;
  const newValue = next?.name ?? next?.email ?? "";

  if (oldValue === newValue) return;

  await db.person.update({ where: { id: personId }, data: { ownerId } });
  await db.activity.create({
    data: {
      entityType: "person",
      entityId: personId,
      field: "Owner",
      oldValue: oldValue || null,
      newValue: newValue || null,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/contacts/${personId}`);
}

export async function setPersonOwners(personIds: string[], ownerId: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const next = ownerId ? await db.user.findUniqueOrThrow({ where: { id: ownerId } }) : null;
  const newValue = next?.name ?? next?.email ?? "";

  const current = await db.person.findMany({ where: { id: { in: personIds } }, include: { owner: true } });

  for (const person of current) {
    const oldValue = person.owner?.name ?? person.owner?.email ?? "";
    if (oldValue === newValue) continue;

    await db.person.update({ where: { id: person.id }, data: { ownerId } });
    await db.activity.create({
      data: {
        entityType: "person",
        entityId: person.id,
        field: "Owner",
        oldValue: oldValue || null,
        newValue: newValue || null,
        actorId: session.user.id,
      },
    });
  }

  revalidatePath("/contacts");
}

export async function setPersonCompany(personId: string, company: { id: string } | { name: string } | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const current = await db.person.findUniqueOrThrow({
    where: { id: personId },
    include: { company: true },
  });
  const oldValue = current.company?.name ?? "";

  let companyId: string | null = null;
  let newValue = "";
  if (company && "id" in company) {
    const found = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    companyId = found.id;
    newValue = found.name;
  } else if (company && "name" in company) {
    const created = await db.company.create({
      data: { name: company.name.trim(), createdById: session.user.id },
    });
    await db.activity.create({
      data: { entityType: "company", entityId: created.id, kind: "created", actorId: session.user.id },
    });
    companyId = created.id;
    newValue = created.name;
  }

  if (oldValue === newValue) return;

  await db.person.update({ where: { id: personId }, data: { companyId } });
  await db.activity.create({
    data: {
      entityType: "person",
      entityId: personId,
      field: FIELD_LABELS.company,
      oldValue: oldValue || null,
      newValue: newValue || null,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/contacts/${personId}`);
  revalidatePath("/contacts");
  if (companyId) revalidatePath(`/companies/${companyId}`);
}

export async function updatePersonField(personId: string, field: Exclude<PersonField, "company">, rawValue: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const value = rawValue.trim();

  if (field === "firstName" && !value) throw new Error("First name is required");

  const current = await db.person.findUniqueOrThrow({ where: { id: personId } });
  const oldValue = current[field] ?? "";
  if (oldValue === value) return;

  const data: Record<string, string | null> = { [field]: value || null };
  if (field === "email" && value && !current.companyId) {
    const derivedName = deriveCompanyNameFromEmail(value);
    if (derivedName) data.companyId = await resolveCompanyId(derivedName, value.split("@")[1]?.toLowerCase().trim());
  }

  await db.person.update({ where: { id: personId }, data });
  await db.activity.create({
    data: {
      entityType: "person",
      entityId: personId,
      field: FIELD_LABELS[field],
      oldValue: oldValue || null,
      newValue: value || null,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/contacts/${personId}`);
  revalidatePath("/contacts");
}
