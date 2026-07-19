import { SettingsHeader } from "@/components/settings-header";

export default function AIPage() {
  return (
    <>
      <SettingsHeader crumbs={["Workspace", "AI"]} />
      <div className="px-8 py-10">
        <h1 className="text-xl font-medium">AI</h1>
        <p className="text-[13px] text-subtle mt-2">Coming soon.</p>
      </div>
    </>
  );
}
