"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type ObjectType = "company" | "person";
export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT";

const SETTINGS_PATH: Record<ObjectType, string> = {
  company: "/settings/data-model/company",
  person: "/settings/data-model/person",
};

const RECORD_LIST_PATH: Record<ObjectType, string> = {
  company: "/companies",
  person: "/contacts",
};

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function listFieldDefinitions(objectType: ObjectType) {
  return db.customFieldDefinition.findMany({
    where: { objectType },
    orderBy: { order: "asc" },
  });
}

export async function createFieldDefinition(
  objectType: ObjectType,
  label: string,
  type: CustomFieldType,
  options?: string[]
) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");
  const key = slugify(trimmed);
  if (!key) throw new Error("Label must contain letters or numbers");

  const last = await db.customFieldDefinition.findFirst({
    where: { objectType },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.customFieldDefinition.create({
    data: {
      objectType,
      key,
      label: trimmed,
      type,
      options: type === "SELECT" ? (options ?? []).map((o) => o.trim()).filter(Boolean) : [],
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath(SETTINGS_PATH[objectType]);
}

export async function deleteFieldDefinition(id: string) {
  const def = await db.customFieldDefinition.delete({ where: { id } });
  revalidatePath(SETTINGS_PATH[def.objectType as ObjectType]);
  revalidatePath(RECORD_LIST_PATH[def.objectType as ObjectType]);
}

export async function getCustomFieldValues(objectType: ObjectType, recordId: string) {
  const definitions = await db.customFieldDefinition.findMany({
    where: { objectType },
    orderBy: { order: "asc" },
    include: { values: { where: { recordId } } },
  });

  return definitions.map((def) => ({
    id: def.id,
    key: def.key,
    label: def.label,
    type: def.type as CustomFieldType,
    options: def.options,
    value: def.values[0]?.value ?? "",
  }));
}

export async function setCustomFieldValue(
  objectType: ObjectType,
  definitionId: string,
  recordId: string,
  value: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [definition, current] = await Promise.all([
    db.customFieldDefinition.findUniqueOrThrow({ where: { id: definitionId } }),
    db.customFieldValue.findUnique({ where: { definitionId_recordId: { definitionId, recordId } } }),
  ]);

  const oldValue = current?.value ?? "";
  const trimmed = value.trim();
  if (oldValue === trimmed) return;

  if (!trimmed) {
    await db.customFieldValue.deleteMany({ where: { definitionId, recordId } });
  } else {
    await db.customFieldValue.upsert({
      where: { definitionId_recordId: { definitionId, recordId } },
      create: { definitionId, recordId, value: trimmed },
      update: { value: trimmed },
    });
  }

  await db.activity.create({
    data: {
      entityType: objectType,
      entityId: recordId,
      field: definition.label,
      oldValue: oldValue || null,
      newValue: trimmed || null,
      actorId: session.user.id,
    },
  });

  revalidatePath(RECORD_LIST_PATH[objectType] + `/${recordId}`);
}
