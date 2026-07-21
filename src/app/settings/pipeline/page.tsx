import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { PipelineStagesManager } from "@/components/pipeline-stages-manager";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";

export default async function PipelineSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Pipeline"]} requiredRole="admin" />;
  }

  const stages = await listPipelineStages();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Pipeline"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Pipeline stages</h1>
        <p className="text-[13px] text-subtle mt-1">
          Define the stages deals move through. Mark a stage as Won or Lost to auto-set its close date.
        </p>

        <PipelineStagesManager stages={stages} />
      </div>
    </>
  );
}
