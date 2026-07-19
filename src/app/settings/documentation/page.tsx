import { SettingsHeader } from "@/components/settings-header";

export default function DocumentationPage() {
  return (
    <>
      <SettingsHeader crumbs={["Other", "Documentation"]} />
      <div className="px-8 py-10">
        <h1 className="text-xl font-medium">Documentation</h1>
        <p className="text-[13px] text-subtle mt-2">Coming soon.</p>
      </div>
    </>
  );
}
