"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EmailTemplate, User } from "@prisma/client";
import {
  List,
  FileText,
  ChevronDown,
  ListFilter,
  ArrowUpDown,
  UserCircle,
  CalendarDays,
  Type,
  Plus,
  Trash2,
} from "lucide-react";
import { SettingsHeader } from "@/components/settings-header";
import { TemplateEditorModal } from "@/components/template-editor-modal";
import { deleteTemplate } from "@/lib/actions/emails";

type TemplateRow = EmailTemplate & { createdBy: User | null };

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AVATAR_COLORS = [
  "bg-rose-500 text-white",
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-500 text-white",
];

function avatarColor(name: string) {
  const code = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className={`size-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-medium ${avatarColor(name || "?")}`}>
      {initials(name) || "?"}
    </div>
  );
}

const GRID_TEMPLATE = "220px 1fr 180px 160px 32px";

export function EmailTemplatesView({ templates }: { templates: TemplateRow[] }) {
  const [editing, setEditing] = useState<TemplateRow | null | undefined>(undefined);
  const router = useRouter();

  function handleSaved() {
    setEditing(undefined);
    router.refresh();
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this template?")) return;
    deleteTemplate(id).then(() => router.refresh());
  }

  return (
    <>
      <SettingsHeader crumbs={["Resources", "Email Templates"]} />
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-1.5 text-[13px]">
            <FileText size={14} strokeWidth={1.75} className="text-emerald-400" />
            <span className="font-medium">Email Templates</span>
          </div>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            New Template
          </button>
        </div>

        <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
          <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
            <List size={14} strokeWidth={1.75} />
            All Templates
            <span className="text-subtle">· {templates.length}</span>
            <ChevronDown size={13} strokeWidth={1.75} />
          </button>

          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
              <ListFilter size={14} strokeWidth={1.75} />
              Filter
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
              <ArrowUpDown size={14} strokeWidth={1.75} />
              Sort
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <FileText size={24} strokeWidth={1.5} className="text-subtle" />
              <p className="text-[13px] text-subtle mt-3">No email templates yet.</p>
            </div>
          ) : (
            <div className="min-w-max">
              <div
                className="grid px-6 py-2 text-[12px] text-subtle border-b border-border sticky top-0 bg-background z-10"
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <span className="flex items-center gap-1.5">
                  <Type size={13} strokeWidth={1.75} />
                  Name
                </span>
                <span className="flex items-center gap-1.5 pl-1">Subject</span>
                <span className="flex items-center gap-1.5 pl-1">
                  <UserCircle size={13} strokeWidth={1.75} />
                  Created by
                </span>
                <span className="flex items-center gap-1.5 pl-1">
                  <CalendarDays size={13} strokeWidth={1.75} />
                  Creation date
                </span>
                <span />
              </div>
              <div className="divide-y divide-border">
                {templates.map((t) => {
                  const createdBy = t.createdBy?.name ?? t.createdBy?.email ?? "";
                  return (
                    <div
                      key={t.id}
                      onClick={() => setEditing(t)}
                      className="grid w-full text-left px-6 py-2.5 items-center hover:bg-muted/40 transition-colors cursor-pointer group"
                      style={{ gridTemplateColumns: GRID_TEMPLATE }}
                    >
                      <span className="text-[13px] truncate pr-2">{t.name}</span>
                      <span className="text-[13px] text-subtle truncate pr-2">{t.subject}</span>
                      <span className="text-[13px] text-subtle truncate pr-2">
                        {createdBy && (
                          <span className="flex items-center gap-1.5">
                            <Avatar name={createdBy} />
                            {createdBy}
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] text-subtle truncate pr-2">{relativeTime(t.createdAt)}</span>
                      <button
                        onClick={(e) => handleDelete(e, t.id)}
                        title="Delete template"
                        className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity justify-self-end"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {editing !== undefined && (
        <TemplateEditorModal template={editing} onClose={() => setEditing(undefined)} onSaved={handleSaved} />
      )}
    </>
  );
}
