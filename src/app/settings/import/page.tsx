import { SettingsHeader } from "@/components/settings-header";
import { ImportPanel } from "@/components/import-panel";

export default function ImportPage() {
  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Import"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Import</h1>
        <p className="text-[13px] text-subtle mt-1">Bring Companies or People in from a CSV file</p>

        <ImportPanel />
      </div>
    </>
  );
}
