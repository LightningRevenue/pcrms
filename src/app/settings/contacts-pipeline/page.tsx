import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { PipelineStagesManager } from "@/components/pipeline-stages-manager";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { listContactPipelineStages } from "@/lib/actions/contact-pipeline-stages";
import {
  createContactPipelineStage,
  updateContactPipelineStage,
  reorderContactPipelineStages,
  countContactsInStage,
  deleteContactPipelineStage,
  setDefaultContactPipelineStage,
} from "@/lib/actions/contact-pipeline-stages";

export default async function ContactsPipelineSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Contacts Pipeline"]} requiredRole="admin" />;
  }

  const stages = await listContactPipelineStages();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Contacts Pipeline"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Contacts pipeline stages</h1>
        <p className="text-[13px] text-subtle mt-1">
          Define the stages contacts move through, shown as the Kanban columns on /contacts.
        </p>

        <PipelineStagesManager
          stages={stages}
          itemNounPlural="contacts"
          actions={{
            create: createContactPipelineStage,
            update: updateContactPipelineStage,
            reorder: reorderContactPipelineStages,
            countInStage: countContactsInStage,
            remove: deleteContactPipelineStage,
          }}
          onSetDefault={setDefaultContactPipelineStage}
          defaultHint="Click the star to pick which stage a new contact starts on (UI or CSV import). No default means new contacts stay unstaged."
        />
      </div>
    </>
  );
}
