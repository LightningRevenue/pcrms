"use client";

import { useState } from "react";
import type { EmailTemplate } from "@prisma/client";
import { Mail, CheckSquare, StickyNote, Phone, CalendarClock, Users as UsersIcon, CheckSquare as GeneralIcon } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { TemplateVariable } from "@/lib/template-variables";
import type { SequenceStepInput, SequenceStepType } from "@/lib/actions/sequences";

const STEP_TYPES: { key: SequenceStepType; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "task", label: "Task", icon: CheckSquare },
  { key: "note", label: "Note", icon: StickyNote },
];

const TASK_TYPES: { key: string; label: string; icon: typeof Phone }[] = [
  { key: "call", label: "Call", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "event", label: "Event", icon: CalendarClock },
  { key: "meet", label: "Meet", icon: UsersIcon },
  { key: "general", label: "General", icon: GeneralIcon },
];

export function SequenceStepForm({
  templates,
  variables,
  onCancel,
  onSave,
}: {
  templates: EmailTemplate[];
  variables: TemplateVariable[];
  onCancel: () => void;
  onSave: (input: SequenceStepInput) => void;
}) {
  const [type, setType] = useState<SequenceStepType>("email");
  const [delayDays, setDelayDays] = useState(0);
  const [delayHours, setDelayHours] = useState(0);

  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [taskPriority, setTaskPriority] = useState("medium");

  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (type === "email" && !templateId && !subject.trim()) {
      setError("Pick a template or write a subject");
      return;
    }
    if (type === "task" && !taskTitle.trim()) {
      setError("Add a task title");
      return;
    }
    if (type === "note" && !noteBody.trim()) {
      setError("Note can't be empty");
      return;
    }
    setError(null);

    onSave({
      type,
      delayDays: Math.max(0, delayDays),
      delayHours: Math.max(0, delayHours),
      templateId: templateId || null,
      subject: templateId ? undefined : subject,
      bodyHtml: templateId ? undefined : bodyHtml,
      taskTitle,
      taskDescription,
      taskType,
      taskPriority,
      noteBody,
    });
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {STEP_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[13px] transition-colors ${
              type === key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-subtle hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {type === "email" && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px] text-subtle">Use a template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
            >
              <option value="" className="bg-background text-foreground">
                Write custom email instead
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} className="bg-background text-foreground">
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {!templateId && (
            <>
              <label className="block">
                <span className="text-[12px] text-subtle">Subject</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Following up, {{person.firstName}}"
                  className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
                />
              </label>
              <div>
                <span className="text-[12px] text-subtle">Body</span>
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Write the email... use the {{ }} button to insert variables"
                  className="mt-1 h-48"
                  variables={variables}
                />
              </div>
            </>
          )}
        </div>
      )}

      {type === "task" && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px] text-subtle">Title</span>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Call to check in"
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-subtle">Description</span>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={2}
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent resize-none focus:border-accent transition-colors"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] text-subtle">Type</span>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.key} value={t.key} className="bg-background text-foreground">
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-subtle">Priority</span>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              >
                {["low", "medium", "high"].map((p) => (
                  <option key={p} value={p} className="bg-background text-foreground capitalize">
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {type === "note" && (
        <label className="block">
          <span className="text-[12px] text-subtle">Note</span>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={4}
            placeholder="e.g. Reminder: mention the {{company.name}} renewal discount"
            className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent resize-none placeholder:text-subtle focus:border-accent transition-colors"
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border">
        <label className="block">
          <span className="text-[12px] text-subtle">Days after start</span>
          <input
            type="number"
            min={0}
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value) || 0)}
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-subtle">Hours</span>
          <input
            type="number"
            min={0}
            max={23}
            value={delayHours}
            onChange={(e) => setDelayHours(Number(e.target.value) || 0)}
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
      </div>

      {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Add step
        </button>
      </div>
    </div>
  );
}
