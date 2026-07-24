"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { deleteObjectDefinition } from "@/lib/actions/objects";

type ObjectRow = {
  id: string;
  slug: string;
  name: string;
  _count: { records: number; fields: number };
};

export function ObjectsListView({ objects: initial }: { objects: ObjectRow[] }) {
  const [objects, setObjects] = useState(initial);
  const [, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This removes the object, its fields, and all its records.`)) return;
    setObjects((prev) => prev.filter((o) => o.id !== id));
    startTransition(() => deleteObjectDefinition(id));
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Boxes size={14} strokeWidth={1.75} className="text-subtle" />
          <span className="font-medium">Objects</span>
        </div>
        <Link
          href="/objects/new"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          New object
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Boxes size={24} strokeWidth={1.5} className="text-subtle" />
            <p className="text-[13px] text-subtle mt-3">No custom objects yet.</p>
            <Link href="/objects/new" className="text-[13px] text-accent mt-1 hover:underline">
              Create your first object
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {objects.map((o) => (
              <Link
                key={o.id}
                href={`/objects/${o.slug}`}
                className="flex items-center gap-6 px-6 py-3 hover:bg-muted/40 transition-colors group"
              >
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <Boxes size={15} strokeWidth={1.75} className="shrink-0 text-subtle" />
                  <span className="text-[13px] truncate">{o.name}</span>
                </span>
                <span className="text-[12px] text-subtle shrink-0">{o._count.fields} fields</span>
                <span className="text-[12px] text-subtle shrink-0">{o._count.records} records</span>
                <Link
                  href={`/objects/${o.slug}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[12px] text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                >
                  Edit fields
                </Link>
                <button
                  onClick={(e) => handleDelete(e, o.id, o.name)}
                  title="Delete object"
                  className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
