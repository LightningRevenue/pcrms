import { SettingsHeader } from "@/components/settings-header";

export default function ExperiencePage() {
  return (
    <>
      <SettingsHeader crumbs={["User", "Experience"]} />
      <div className="px-8 py-10">
        <h1 className="text-xl font-medium">Experience</h1>
        <p className="text-[13px] text-subtle mt-2">Coming soon.</p>
      </div>
    </>
  );
}
