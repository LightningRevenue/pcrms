import { SettingsHeader } from "@/components/settings-header";
import { SidebarLayoutManager } from "@/components/sidebar-layout-manager";

export default function LayoutPage() {
  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Layout"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Sidebar layout</h1>
        <p className="text-[13px] text-subtle mt-1">
          Choose what shows in your sidebar and in what order. Saved to this browser.
        </p>

        <SidebarLayoutManager />
      </div>
    </>
  );
}
