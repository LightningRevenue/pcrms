import { SettingsHeader } from "@/components/settings-header";
import { SidebarLayoutManager } from "@/components/sidebar-layout-manager";
import { ViewModeToggle } from "@/components/view-mode-toggle";

export default function LayoutPage() {
  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Layout"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Contact view</h1>
        <p className="text-[13px] text-subtle mt-1">
          Choose how contact pages open across the app. Saved to this browser.
        </p>

        <div className="mt-6">
          <ViewModeToggle />
        </div>

        <h1 className="text-xl font-medium mt-10">Sidebar layout</h1>
        <p className="text-[13px] text-subtle mt-1">
          Choose what shows in your sidebar and in what order. Saved to this browser.
        </p>

        <SidebarLayoutManager />
      </div>
    </>
  );
}
