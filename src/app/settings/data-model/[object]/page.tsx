import { notFound } from "next/navigation";
import { SettingsHeader } from "@/components/settings-header";
import { ObjectFieldsManager } from "@/components/object-fields-manager";
import { listFieldDefinitions, type ObjectType } from "@/lib/actions/custom-fields";

const OBJECT_LABELS: Record<ObjectType, string> = {
  company: "Companies",
  person: "People",
};

const STANDARD_FIELDS: Record<ObjectType, string[]> = {
  company: ["Name", "Domain Name", "Address", "Linkedin", "Annual Revenue"],
  person: ["First name", "Last name", "Email", "Phone", "Job Title", "LinkedIn"],
};

export default async function ObjectFieldsPage({
  params,
}: {
  params: Promise<{ object: string }>;
}) {
  const { object } = await params;
  if (object !== "company" && object !== "person") notFound();

  const objectType = object as ObjectType;
  const customFields = await listFieldDefinitions(objectType);

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Data model", OBJECT_LABELS[objectType]]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">{OBJECT_LABELS[objectType]}</h1>
        <p className="text-[13px] text-subtle mt-1">Manage fields for this object</p>

        <ObjectFieldsManager
          objectType={objectType}
          standardFields={STANDARD_FIELDS[objectType]}
          customFields={customFields}
        />
      </div>
    </>
  );
}
