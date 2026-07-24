"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, ExternalLink, Check, Loader2, Settings2 } from "lucide-react";
import {
  getLinkedinFinderConfig,
  saveLinkedinFinderConfig,
  runLinkedinSearch,
  listRecentProspects,
  importProspectToPerson,
  type FinderProspect,
  type LinkedinFinderConfig,
} from "@/lib/actions/linkedin-finder";

function ConfigPanel({ config, onSaved }: { config: LinkedinFinderConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(!config.hasCookie || !config.hasProxy);
  const [liAt, setLiAt] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveLinkedinFinderConfig(liAt, proxyUrl);
        setLiAt("");
        setProxyUrl("");
        setOpen(false);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="border border-border rounded-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-subtle hover:text-foreground transition-colors"
      >
        <Settings2 size={14} strokeWidth={1.75} />
        Cookie & proxy
        <span className="ml-auto text-[12px]">
          {config.hasCookie && config.hasProxy ? "Configured" : "Setup required"}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
          <div>
            <label className="text-[12px] text-subtle">li_at cookie</label>
            <input
              value={liAt}
              onChange={(e) => setLiAt(e.target.value)}
              placeholder={config.hasCookie ? "•••••••••••••• (saved — enter a new value to replace)" : "AQEDATxxxxxxxxxxxxxxxxxxxxxxxx"}
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors font-mono"
            />
          </div>
          <div>
            <label className="text-[12px] text-subtle">Proxy URL</label>
            <input
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder={config.hasProxy ? "•••••••••••••• (saved — enter a new value to replace)" : "http://user:pass@host:port"}
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors font-mono"
            />
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <button
            onClick={save}
            disabled={pending || !liAt.trim() || !proxyUrl.trim()}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export function LinkedinFinderPanel() {
  const [config, setConfig] = useState<LinkedinFinderConfig | null>(null);
  const [query, setQuery] = useState("");
  const [prospects, setProspects] = useState<FinderProspect[]>([]);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  function loadConfig() {
    getLinkedinFinderConfig().then(setConfig);
  }

  useEffect(() => {
    loadConfig();
    listRecentProspects().then(setProspects);
  }, []);

  function search() {
    setError(null);
    startSearch(async () => {
      try {
        const results = await runLinkedinSearch(query);
        setProspects(results);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      }
    });
  }

  function doImport(id: string) {
    setImporting((prev) => new Set(prev).add(id));
    importProspectToPerson(id)
      .then((personId) => {
        setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, importedPersonId: personId } : p)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Import failed"))
      .finally(() =>
        setImporting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        })
      );
  }

  return (
    <div className="mt-6 space-y-4">
      {config && <ConfigPanel config={config} onSaved={loadConfig} />}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. CTO startup Bucharest"
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors"
          />
        </div>
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
        >
          {searching && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <div className="border border-border rounded-md overflow-hidden">
        <div className="max-h-[32rem] overflow-y-auto divide-y divide-border">
          {prospects.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate">{p.name}</p>
                <p className="text-[12px] text-subtle truncate">
                  {[p.headline, p.location].filter(Boolean).join(" · ")}
                </p>
              </div>
              {p.linkedin && (
                <a
                  href={p.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-subtle hover:text-foreground transition-colors"
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                </a>
              )}
              {p.importedPersonId ? (
                <span className="flex items-center gap-1 text-[12px] text-green-600 shrink-0">
                  <Check size={13} strokeWidth={2} /> Imported
                </span>
              ) : (
                <button
                  onClick={() => doImport(p.id)}
                  disabled={importing.has(p.id)}
                  className="shrink-0 px-2.5 py-1 rounded-md text-[12px] border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {importing.has(p.id) ? "Importing…" : "Import"}
                </button>
              )}
            </div>
          ))}
          {prospects.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-subtle">
              No prospects yet — run a search above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
