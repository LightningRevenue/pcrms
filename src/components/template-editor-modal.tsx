"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { EmailTemplate } from "@prisma/client";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createTemplate, updateTemplate } from "@/lib/actions/emails";
import { listTemplateVariables, type TemplateVariable } from "@/lib/template-variables";

export function TemplateEditorModal({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml ?? "");
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listTemplateVariables().then(setVariables).catch(() => {});
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (template) {
        await updateTemplate(template.id, { name, subject, bodyHtml });
      } else {
        await createTemplate({ name, subject, bodyHtml });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-3xl h-[85vh] bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">{template ? "Edit template" : "New template"}</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          <label className="block">
            <span className="text-[12px] text-subtle">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Renewal follow-up"
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-[12px] text-subtle">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Following up, {{person.firstName}}"
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>

          <div className="flex-1 min-h-0 flex flex-col">
            <span className="text-[12px] text-subtle mb-1">Body</span>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Write your template... use the {{ }} button to insert variables"
              className="flex-1"
              variables={variables}
            />
          </div>

          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <div className="h-14 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
