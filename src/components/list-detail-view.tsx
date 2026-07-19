"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Activity, Task } from "@prisma/client";
import { List as ListIcon, Plus } from "lucide-react";
import { CompaniesView, type CompanyRow, type CompanyCustomField } from "@/components/companies-view";
import { ContactsView, type PersonRow, type PersonCustomField } from "@/components/contacts-view";
import { ListDealsView } from "@/components/list-deals-view";
import { AddToListModal } from "@/components/add-to-list-modal";
import type { OpportunityRow } from "@/components/opportunities-view";
import type { ListEntityType } from "@/lib/actions/lists";

function Header({ name, entityType, count }: { name: string; entityType: string; count: number }) {
  const router = useRouter();
  return (
    <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
      <button onClick={() => router.push("/lists")} className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ListIcon size={14} strokeWidth={1.75} />
        Lists
      </button>
      <span className="text-subtle text-[13px]">/</span>
      <span className="text-[13px] font-medium">{name}</span>
      <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-subtle capitalize">{entityType}</span>
      <span className="text-[12px] text-subtle">· {count} items</span>
    </div>
  );
}

export function ListDetailView(
  props:
    | {
        id: string;
        name: string;
        entityType: "company";
        companies: CompanyRow[];
        lastActivityByCompany: Map<string, Activity>;
        customFields: CompanyCustomField[];
      }
    | {
        id: string;
        name: string;
        entityType: "person";
        people: PersonRow[];
        lastActivityByPerson: Map<string, Activity>;
        nextTaskByPerson: Map<string, Task>;
        customFields: PersonCustomField[];
      }
    | {
        id: string;
        name: string;
        entityType: "opportunity";
        opportunities: OpportunityRow[];
      }
) {
  const [adding, setAdding] = useState(false);

  if (props.entityType === "company") {
    return (
      <div className="flex flex-col h-screen">
        <Header name={props.name} entityType="company" count={props.companies.length} />
        <div className="flex-1 min-h-0 [&>div]:!h-full">
          <CompaniesView
            companies={props.companies}
            lastActivityByCompany={props.lastActivityByCompany}
            customFields={props.customFields}
            title={props.name}
            onAddClick={() => setAdding(true)}
          />
        </div>
        {adding && <AddToListModal listId={props.id} onClose={() => setAdding(false)} />}
      </div>
    );
  }

  if (props.entityType === "person") {
    return (
      <div className="flex flex-col h-screen">
        <Header name={props.name} entityType="person" count={props.people.length} />
        <div className="flex-1 min-h-0 [&>div]:!h-full">
          <ContactsView
            people={props.people}
            lastActivityByPerson={props.lastActivityByPerson}
            nextTaskByPerson={props.nextTaskByPerson}
            customFields={props.customFields}
            title={props.name}
            onAddClick={() => setAdding(true)}
          />
        </div>
        {adding && <AddToListModal listId={props.id} onClose={() => setAdding(false)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header name={props.name} entityType="opportunity" count={props.opportunities.length} />
      <div className="h-11 shrink-0 flex items-center justify-end px-6 border-b border-border">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          Add Deals
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <ListDealsView opportunities={props.opportunities} />
      </div>
      {adding && <AddToListModal listId={props.id} onClose={() => setAdding(false)} />}
    </div>
  );
}

export type { ListEntityType };
