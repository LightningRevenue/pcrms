"use server";

import { db } from "@/lib/db";
import { PERSON_FIELD_LABELS, COMPANY_FIELD_LABELS } from "@/lib/field-labels";

export type TemplateVariable = { token: string; label: string };

const PERSON_TOKEN_FIELDS = ["firstName", "lastName", "email", "phone", "jobTitle", "linkedin"] as const;
const COMPANY_TOKEN_FIELDS = ["name", "domain", "address", "linkedin", "annualRevenue"] as const;

export async function listTemplateVariables(): Promise<TemplateVariable[]> {
  const [personCustom, companyCustom] = await Promise.all([
    db.customFieldDefinition.findMany({ where: { objectType: "person" }, orderBy: { order: "asc" } }),
    db.customFieldDefinition.findMany({ where: { objectType: "company" }, orderBy: { order: "asc" } }),
  ]);

  return [
    ...PERSON_TOKEN_FIELDS.map((key) => ({ token: `person.${key}`, label: `Contact ${PERSON_FIELD_LABELS[key]}` })),
    ...personCustom.map((f) => ({ token: `person.custom.${f.key}`, label: `Contact ${f.label}` })),
    ...COMPANY_TOKEN_FIELDS.map((key) => ({ token: `company.${key}`, label: `Company ${COMPANY_FIELD_LABELS[key]}` })),
    ...companyCustom.map((f) => ({ token: `company.custom.${f.key}`, label: `Company ${f.label}` })),
  ];
}

async function buildVariableMap(personId: string): Promise<Record<string, string>> {
  const person = await db.person.findUnique({ where: { id: personId }, include: { company: true } });
  if (!person) return {};

  const [personCustom, companyCustom] = await Promise.all([
    db.customFieldValue.findMany({
      where: { recordId: personId, definition: { objectType: "person" } },
      include: { definition: true },
    }),
    person.companyId
      ? db.customFieldValue.findMany({
          where: { recordId: person.companyId, definition: { objectType: "company" } },
          include: { definition: true },
        })
      : Promise.resolve([]),
  ]);

  const map: Record<string, string> = {};
  for (const key of PERSON_TOKEN_FIELDS) map[`person.${key}`] = person[key] ?? "";
  for (const key of COMPANY_TOKEN_FIELDS) map[`company.${key}`] = person.company?.[key] ?? "";
  for (const v of personCustom) map[`person.custom.${v.definition.key}`] = v.value ?? "";
  for (const v of companyCustom) map[`company.custom.${v.definition.key}`] = v.value ?? "";

  return map;
}

// ponytail: unresolved tokens fall back to "" (matches how empty fields render elsewhere in the app)
export async function interpolateForPerson(text: string, personId: string): Promise<string> {
  const map = await buildVariableMap(personId);
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, token) => map[token] ?? "");
}
