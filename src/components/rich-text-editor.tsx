"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Braces } from "lucide-react";
import type { TemplateVariable } from "@/lib/template-variables";

const COMMANDS = [
  { command: "bold", icon: Bold, label: "Bold" },
  { command: "italic", icon: Italic, label: "Italic" },
  { command: "underline", icon: Underline, label: "Underline" },
  { command: "insertUnorderedList", icon: List, label: "Bullet list" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
] as const;

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  variables,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  variables?: TemplateVariable[];
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [showVariables, setShowVariables] = useState(false);
  const variablesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (editorRef.current) editorRef.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showVariables) return;
    function onClick(e: MouseEvent) {
      if (!variablesRef.current?.contains(e.target as Node)) setShowVariables(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showVariables]);

  function exec(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function insertVariable(token: string) {
    editorRef.current?.focus();
    document.execCommand("insertText", false, `{{${token}}}`);
    onChange(editorRef.current?.innerHTML ?? "");
    setShowVariables(false);
  }

  return (
    <div className={`border border-border rounded-md overflow-hidden flex flex-col ${className ?? ""}`}>
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/50 shrink-0">
        {COMMANDS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(command)}
            className="p-1.5 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <Icon size={14} strokeWidth={1.75} />
          </button>
        ))}
        <button
          type="button"
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          className="p-1.5 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors"
        >
          <LinkIcon size={14} strokeWidth={1.75} />
        </button>

        {variables && variables.length > 0 && (
          <div className="relative" ref={variablesRef}>
            <button
              type="button"
              title="Insert variable"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowVariables((v) => !v)}
              className="flex items-center gap-1 px-1.5 py-1.5 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors"
            >
              <Braces size={14} strokeWidth={1.75} />
            </button>
            {showVariables && (
              <div className="absolute left-0 top-full mt-1 w-64 max-h-64 overflow-y-auto bg-background border border-border rounded-md shadow-lg z-20 py-1">
                {variables.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(v.token)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted transition-colors"
                  >
                    <span className="text-[13px] truncate">{v.label}</span>
                    <span className="text-[11px] text-subtle shrink-0">{`{{${v.token}}}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-[13px] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-subtle"
      />
    </div>
  );
}
