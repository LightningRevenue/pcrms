"use client";

import { useRef, useState } from "react";
import { Building2, Users, Download, Upload } from "lucide-react";
import { ImportMappingModal } from "@/components/import-mapping-modal";
import { ImportProgressOverlay } from "@/components/import-progress-overlay";
import { parseCsvPreview, startImport } from "@/lib/actions/import";
import { exampleCsv } from "@/lib/import-example";
import type { ObjectType } from "@/lib/actions/custom-fields";
import type { ImportField } from "@/lib/import-fields";

type Preview = {
  headers: string[];
  preview: string[][];
  rowCount: number;
  fields: ImportField[];
  suggestedMapping: Record<string, string | null>;
};

const OBJECT_TYPES: { key: ObjectType; label: string; icon: typeof Building2 }[] = [
  { key: "company", label: "Companies", icon: Building2 },
  { key: "person", label: "People", icon: Users },
];

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPanel() {
  const [objectType, setObjectType] = useState<ObjectType>("company");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name.replace(/\.csv$/i, ""));
    try {
      const result = await parseCsvPreview(objectType, text);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read CSV");
    }
  }

  async function handleConfirmMapping(name: string, mapping: Record<string, string>) {
    if (!csvText) return;
    setError(null);
    setPreview(null);
    try {
      const id = await startImport(objectType, name, csvText, mapping);
      setBatchId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start import");
    }
  }

  function reset() {
    setCsvText(null);
    setFileName("");
    setPreview(null);
    setBatchId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mt-6">
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">Import into</p>
      <div className="flex gap-2">
        {OBJECT_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setObjectType(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-[13px] transition-colors ${
              objectType === key
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-subtle hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 border border-border rounded-lg p-5">
        <p className="text-[13px] font-medium">1. Get the template</p>
        <p className="text-[12px] text-subtle mt-1">Download an example CSV with the expected columns.</p>
        <button
          onClick={() => downloadFile(`${objectType}-import-example.csv`, exampleCsv(objectType))}
          className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          <Download size={14} strokeWidth={1.75} />
          Download example CSV
        </button>

        <div className="border-t border-border my-5" />

        <p className="text-[13px] font-medium">2. Upload your file</p>
        <p className="text-[12px] text-subtle mt-1">Any CSV works — you&apos;ll map its columns next.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
          id="import-file-input"
        />
        <label
          htmlFor="import-file-input"
          className="flex items-center gap-1.5 mt-3 w-fit px-3 py-1.5 rounded-md bg-accent text-white text-[13px] hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Upload size={14} strokeWidth={1.75} />
          Choose CSV file
        </label>

        {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
      </div>

      {preview && (
        <ImportMappingModal
          headers={preview.headers}
          preview={preview.preview}
          rowCount={preview.rowCount}
          fields={preview.fields}
          suggestedMapping={preview.suggestedMapping}
          defaultName={fileName || "Untitled import"}
          onClose={reset}
          onConfirm={handleConfirmMapping}
        />
      )}

      {batchId && <ImportProgressOverlay batchId={batchId} onDone={reset} />}
    </div>
  );
}
