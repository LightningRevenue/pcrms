"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";

export type FieldType = "text" | "number" | "date" | "boolean" | "select" | "relation";

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listObjectDefinitions() {
  const { workspaceId } = await requireWorkspace();
  return db.objectDefinition.findMany({
    where: { workspaceId },
    include: { _count: { select: { records: true, fields: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getObjectDefinitionBySlug(slug: string) {
  const { workspaceId } = await requireWorkspace();
  return db.objectDefinition.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
    include: { fields: { orderBy: { order: "asc" } } },
  });
}

export type FieldInput = {
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  relationTarget?: string | null;
};

export async function createObjectDefinition(name: string, fields: FieldInput[]) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "custom_objects_feature");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const slug = slugify(trimmed);
  if (!slug) throw new Error("Name must contain letters or numbers");

  const singular = trimmed.replace(/s$/i, "") || trimmed;

  const object = await db.objectDefinition.create({
    data: {
      workspaceId,
      createdById: userId,
      slug,
      name: trimmed,
      nameSingular: singular,
      namePlural: trimmed,
      fields: {
        create: fields.map((f, i) => ({ ...buildFieldData(f, i), workspaceId })),
      },
    },
  });

  revalidatePath("/objects");
  return object;
}

export async function deleteObjectDefinition(id: string) {
  const { workspaceId } = await requireWorkspace();
  await db.objectDefinition.delete({ where: { id, workspaceId } });
  revalidatePath("/objects");
}

function buildFieldData(f: FieldInput, order: number) {
  const label = f.label.trim();
  if (!label) throw new Error("Field label is required");
  const key = slugify(label).replace(/-/g, "_");
  if (!key) throw new Error("Field label must contain letters or numbers");
  if (f.type === "relation" && !f.relationTarget) throw new Error(`Field "${label}" needs a relation target`);

  return {
    key,
    label,
    type: f.type,
    options: f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : [],
    required: !!f.required,
    relationTarget: f.type === "relation" ? f.relationTarget : null,
    order,
  };
}

export async function addFieldToObject(objectDefinitionId: string, field: FieldInput) {
  const { workspaceId } = await requireWorkspace();
  const object = await db.objectDefinition.findUniqueOrThrow({
    where: { id: objectDefinitionId, workspaceId },
    include: { fields: true },
  });

  const nextOrder = object.fields.length;
  await db.fieldDefinition.create({
    data: { workspaceId, objectDefinitionId, ...buildFieldData(field, nextOrder) },
  });

  revalidatePath(`/objects/${object.slug}`);
  revalidatePath(`/objects/${object.slug}/edit`);
}

export async function deleteField(fieldId: string) {
  const { workspaceId } = await requireWorkspace();
  const field = await db.fieldDefinition.delete({
    where: { id: fieldId, workspaceId },
    include: { objectDefinition: true },
  });

  // Drop the now-orphaned values from every record rather than leaving dead keys behind.
  const records = await db.objectRecord.findMany({
    where: { workspaceId, objectDefinitionId: field.objectDefinitionId },
  });
  await Promise.all(
    records.map((r) => {
      const values = { ...(r.values as Record<string, unknown>) };
      delete values[field.key];
      return db.objectRecord.update({ where: { id: r.id }, data: { values: values as Prisma.InputJsonValue } });
    })
  );

  revalidatePath(`/objects/${field.objectDefinition.slug}`);
  revalidatePath(`/objects/${field.objectDefinition.slug}/edit`);
}

// Sets (or clears, when dependsOnFieldId is null) a field's conditional-visibility rule.
// dependsOnValue null means "active whenever the parent has any value"; set means "active
// only when the parent equals exactly this value" (used for select/boolean gating fields).
export async function setFieldDependency(fieldId: string, dependsOnFieldId: string | null, dependsOnValue: string | null) {
  const { workspaceId } = await requireWorkspace();
  if (dependsOnFieldId === fieldId) throw new Error("A field can't depend on itself");

  const field = await db.fieldDefinition.update({
    where: { id: fieldId, workspaceId },
    data: { dependsOnFieldId, dependsOnValue: dependsOnFieldId ? dependsOnValue : null },
    include: { objectDefinition: true },
  });

  revalidatePath(`/objects/${field.objectDefinition.slug}`);
  revalidatePath(`/objects/${field.objectDefinition.slug}/edit`);
}

// Saves a field's position on the custom layout canvas. Once any field in an object has a
// layout position, the record form switches from the default linear list to absolute
// positioning (see ObjectRecordsView).
export async function setFieldLayout(fieldId: string, x: number, y: number, w: number) {
  const { workspaceId } = await requireWorkspace();
  const field = await db.fieldDefinition.update({
    where: { id: fieldId, workspaceId },
    data: { layoutX: Math.round(x), layoutY: Math.round(y), layoutW: Math.round(w) },
    include: { objectDefinition: true },
  });

  revalidatePath(`/objects/${field.objectDefinition.slug}`);
  revalidatePath(`/objects/${field.objectDefinition.slug}/edit`);
}

// Resolves a relation field's target into a display label, whether it points at a built-in
// CRM entity or another custom object's record.
async function resolveRelationLabel(workspaceId: string, target: string, recordId: string): Promise<string | null> {
  if (target === "person") {
    const p = await db.person.findUnique({ where: { id: recordId, workspaceId } });
    return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || "Untitled" : null;
  }
  if (target === "company") {
    const c = await db.company.findUnique({ where: { id: recordId, workspaceId } });
    return c?.name ?? null;
  }
  if (target === "opportunity") {
    const o = await db.opportunity.findUnique({ where: { id: recordId, workspaceId } });
    return o?.name ?? null;
  }
  const r = await db.objectRecord.findUnique({ where: { id: recordId, workspaceId } });
  if (!r) return null;
  const values = r.values as Record<string, unknown>;
  return (Object.values(values).find((v) => typeof v === "string" && v.trim()) as string) ?? "Untitled";
}

export type ObjectRecordRow = {
  id: string;
  values: Record<string, unknown>;
  relationLabels: Record<string, string | null>;
};

export async function listObjectRecords(objectDefinitionId: string): Promise<ObjectRecordRow[]> {
  const { workspaceId } = await requireWorkspace();
  const [object, records] = await Promise.all([
    db.objectDefinition.findUniqueOrThrow({ where: { id: objectDefinitionId, workspaceId }, include: { fields: true } }),
    db.objectRecord.findMany({ where: { workspaceId, objectDefinitionId }, orderBy: { createdAt: "desc" } }),
  ]);

  const relationFields = object.fields.filter((f) => f.type === "relation");

  return Promise.all(
    records.map(async (r) => {
      const values = r.values as Record<string, unknown>;
      const relationLabels: Record<string, string | null> = {};
      for (const f of relationFields) {
        const targetId = values[f.key];
        if (typeof targetId === "string" && targetId) {
          relationLabels[f.key] = await resolveRelationLabel(workspaceId, f.relationTarget!, targetId);
        }
      }
      return { id: r.id, values, relationLabels };
    })
  );
}

type CoercibleField = {
  id: string;
  key: string;
  type: string;
  required: boolean;
  dependsOnFieldId: string | null;
  dependsOnValue: string | null;
};

// Validates + coerces raw form input against the object's field definitions before writing —
// the JSONB `values` blob is never trusted as-is, this is the one place shaping it. A field
// whose dependsOnField condition isn't met is skipped entirely: not required, not written,
// regardless of what the client sent for it.
function coerceValues(fields: CoercibleField[], input: Record<string, unknown>) {
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    const parentField = f.dependsOnFieldId ? byId.get(f.dependsOnFieldId) : null;
    if (parentField) {
      const parentValue = input[parentField.key];
      const active = f.dependsOnValue
        ? String(parentValue ?? "") === f.dependsOnValue
        : parentValue !== undefined && parentValue !== null && parentValue !== "";
      if (!active) continue;
    }

    const raw = input[f.key];
    if (raw === undefined || raw === null || raw === "") {
      if (f.required) throw new Error(`"${f.key}" is required`);
      continue;
    }
    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`"${f.key}" must be a number`);
      values[f.key] = n;
    } else if (f.type === "boolean") {
      values[f.key] = raw === true || raw === "true";
    } else if (f.type === "date") {
      const d = new Date(raw as string);
      if (Number.isNaN(d.getTime())) throw new Error(`"${f.key}" must be a valid date`);
      values[f.key] = d.toISOString();
    } else {
      values[f.key] = String(raw);
    }
  }
  return values;
}

export async function createObjectRecord(objectDefinitionId: string, input: Record<string, unknown>) {
  const { userId, workspaceId } = await requireWorkspace();
  const object = await db.objectDefinition.findUniqueOrThrow({
    where: { id: objectDefinitionId, workspaceId },
    include: { fields: true },
  });

  const values = coerceValues(object.fields, input);
  await db.objectRecord.create({
    data: { workspaceId, objectDefinitionId, createdById: userId, values: values as Prisma.InputJsonValue },
  });

  revalidatePath(`/objects/${object.slug}`);
}

export async function updateObjectRecord(recordId: string, input: Record<string, unknown>) {
  const { workspaceId } = await requireWorkspace();
  const record = await db.objectRecord.findUniqueOrThrow({
    where: { id: recordId, workspaceId },
    include: { objectDefinition: { include: { fields: true } } },
  });

  const values = coerceValues(record.objectDefinition.fields, input);
  await db.objectRecord.update({ where: { id: recordId }, data: { values: values as Prisma.InputJsonValue } });

  revalidatePath(`/objects/${record.objectDefinition.slug}`);
}

export async function deleteObjectRecord(recordId: string) {
  const { workspaceId } = await requireWorkspace();
  const record = await db.objectRecord.delete({
    where: { id: recordId, workspaceId },
    include: { objectDefinition: true },
  });
  revalidatePath(`/objects/${record.objectDefinition.slug}`);
}

// Options for a "relation" field's target picker when building/editing a schema.
export async function listRelationTargetOptions(excludeObjectDefinitionId?: string) {
  const { workspaceId } = await requireWorkspace();
  const customObjects = await db.objectDefinition.findMany({
    where: { workspaceId, id: excludeObjectDefinitionId ? { not: excludeObjectDefinitionId } : undefined },
    orderBy: { name: "asc" },
  });

  return [
    { value: "person", label: "Contacts" },
    { value: "company", label: "Companies" },
    { value: "opportunity", label: "Deals" },
    ...customObjects.map((o) => ({ value: o.id, label: o.name })),
  ];
}

// Rows for a relation field's value picker (searchable list of candidate targets).
export async function searchRelationCandidates(target: string, query: string) {
  const { workspaceId } = await requireWorkspace();
  const q = query.trim();

  if (target === "person") {
    const rows = await db.person.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}),
      },
      take: 20,
    });
    return rows.map((p) => ({ id: p.id, label: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Untitled" }));
  }
  if (target === "company") {
    const rows = await db.company.findMany({
      where: { workspaceId, deletedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
      take: 20,
    });
    return rows.map((c) => ({ id: c.id, label: c.name }));
  }
  if (target === "opportunity") {
    const rows = await db.opportunity.findMany({
      where: { workspaceId, deletedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
      take: 20,
    });
    return rows.map((o) => ({ id: o.id, label: o.name }));
  }

  const rows = await db.objectRecord.findMany({ where: { workspaceId, objectDefinitionId: target }, take: 20 });
  return rows.map((r) => {
    const values = r.values as Record<string, unknown>;
    const label = (Object.values(values).find((v) => typeof v === "string" && v.trim()) as string) ?? "Untitled";
    return { id: r.id, label };
  });
}
