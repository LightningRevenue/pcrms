"use client";

import { useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import type { PlaybookSectionInput } from "@/lib/actions/playbooks";
import { createPlaybook, updatePlaybook } from "@/lib/actions/playbooks";
import type { PlaybookRow } from "@/components/playbooks-view";

function emptySection(): PlaybookSectionInput {
  return { title: "", body: "" };
}

export function PlaybookEditorModal({
  playbook,
  onClose,
  onSaved,
}: {
  playbook: PlaybookRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(playbook?.title ?? "");
  const [sections, setSections] = useState<PlaybookSectionInput[]>(
    playbook?.sections.length ? playbook.sections.map((s) => ({ title: s.title, body: s.body })) : [emptySection()]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateSection(i: number, patch: Partial<PlaybookSectionInput>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection()]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveSection(i: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const cleanSections = sections
      .map((s: PlaybookSectionInput) => ({ title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title || s.body);
    if (cleanSections.length === 0) {
      setError("Add at least one section");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (playbook) {
        await updatePlaybook(playbook.id, { title, sections: cleanSections });
      } else {
        await createPlaybook({ title, sections: cleanSections });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save playbook");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-3xl h-[85vh] bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">{playbook ? "Edit playbook" : "New playbook"}</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <label className="block">
            <span className="text-[12px] text-subtle">Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cold Call Discovery"
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>

          <div className="flex flex-col gap-3">
            {sections.map((section, i) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                  <GripVertical size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(i, { title: e.target.value })}
                    placeholder={`Section ${i + 1} title`}
                    className="flex-1 min-w-0 text-[13px] font-medium outline-none bg-transparent placeholder:text-subtle placeholder:font-normal"
                  />
                  <button
                    onClick={() => moveSection(i, -1)}
                    disabled={i === 0}
                    title="Move up"
                    className="p-1 rounded text-subtle hover:bg-background hover:text-foreground transition-colors disabled:opacity-30"
                  >
                    <ChevronUp size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => moveSection(i, 1)}
                    disabled={i === sections.length - 1}
                    title="Move down"
                    className="p-1 rounded text-subtle hover:bg-background hover:text-foreground transition-colors disabled:opacity-30"
                  >
                    <ChevronDown size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => removeSection(i)}
                    title="Remove section"
                    className="p-1 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
                <textarea
                  value={section.body}
                  onChange={(e) => updateSection(i, { body: e.target.value })}
                  placeholder="Write what to say or check for this section…"
                  rows={4}
                  className="w-full px-3 py-2 text-[13px] outline-none bg-transparent placeholder:text-subtle resize-none"
                />
              </div>
            ))}

            <button
              onClick={addSection}
              className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus size={14} strokeWidth={1.75} />
              Add section
            </button>
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
