import Link from "next/link";
import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { DataModelDiagram } from "@/components/data-model-diagram";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { db } from "@/lib/db";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { requireWorkspace } from "@/lib/workspace";
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  Box,
  LayoutGrid,
  StickyNote,
  Target,
  Users,
  CheckSquare,
  Workflow,
  Compass,
} from "lucide-react";

const STANDARD_FIELD_COUNT = { company: 5, person: 6 };

const MOCK_OBJECTS = [
  { name: "Dashboards", icon: LayoutGrid, fields: 9, records: 0 },
  { name: "Notes", icon: StickyNote, fields: 10, records: 0 },
  { name: "Opportunities", icon: Target, fields: 18, records: 0 },
  { name: "Tasks", icon: CheckSquare, fields: 13, records: 0 },
  { name: "Workflows", icon: Workflow, fields: 13, records: 0 },
];

export default async function DataModelPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Data model"]} requiredRole="admin" />;
  }

  const { workspaceId } = await requireWorkspace();

  const [companyCustomFields, personCustomFields, companyCount, personCount] = await Promise.all([
    listFieldDefinitions("company"),
    listFieldDefinitions("person"),
    db.company.count({ where: { workspaceId, deletedAt: null } }),
    db.person.count({ where: { workspaceId, deletedAt: null } }),
  ]);

  const objects = [
    {
      name: "Companies",
      icon: Box,
      href: "/settings/data-model/company",
      fields: STANDARD_FIELD_COUNT.company + companyCustomFields.length,
      records: companyCount,
    },
    {
      name: "People",
      icon: Users,
      href: "/settings/data-model/person",
      fields: STANDARD_FIELD_COUNT.person + personCustomFields.length,
      records: personCount,
    },
    ...MOCK_OBJECTS.map((o) => ({ ...o, href: null as string | null })),
  ];

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Data model"]} />
      <div className="px-8 py-10 max-w-4xl">
        <DataModelDiagram />

        <h1 className="text-xl font-medium mt-8">Objects</h1>
        <p className="text-[13px] text-subtle mt-1">Manage objects, fields and relationships</p>

        <div className="flex items-center gap-2 mt-5">
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border text-[13px] text-subtle focus-within:text-foreground focus-within:border-accent transition-colors">
            <Search size={15} strokeWidth={1.75} className="shrink-0" />
            <input
              placeholder="Search for an object..."
              className="w-full bg-transparent outline-none placeholder:text-subtle text-foreground"
            />
          </div>
          <button className="p-2 rounded-md border border-border text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <SlidersHorizontal size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 border border-border rounded-md overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_90px_90px_28px] gap-3 px-3 py-2 border-b border-border text-[11px] font-medium text-subtle">
            <span>Name</span>
            <span>App</span>
            <span className="text-right">Fields</span>
            <span className="text-right">Records</span>
            <span />
          </div>
          {objects.map(({ name, icon: Icon, href, fields, records }) => {
            const row = (
              <div className="grid grid-cols-[1fr_120px_90px_90px_28px] gap-3 px-3 py-2.5 items-center text-[13px] border-b border-border last:border-b-0 hover:bg-muted transition-colors">
                <span className="flex items-center gap-2.5">
                  <Icon size={15} strokeWidth={1.75} className="text-subtle shrink-0" />
                  {name}
                </span>
                <span className="flex items-center gap-1.5 text-subtle">
                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-[3px] bg-blue-500 text-white text-[9px] font-medium shrink-0">
                    S
                  </span>
                  Standard
                </span>
                <span className="text-right text-subtle">{fields}</span>
                <span className="text-right text-subtle">{records}</span>
                <ChevronRight size={14} strokeWidth={1.75} className="text-subtle justify-self-end" />
              </div>
            );
            return href ? (
              <Link key={name} href={href} className="block cursor-pointer">
                {row}
              </Link>
            ) : (
              <div key={name} className="cursor-default">
                {row}
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <h2 className="text-[13px] font-medium">Visualize data model</h2>
          <p className="text-[13px] text-subtle mt-1">See your data structure as an interactive diagram</p>
          <button className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors">
            <Compass size={14} strokeWidth={1.75} />
            Visualize
          </button>
        </div>
      </div>
    </>
  );
}
