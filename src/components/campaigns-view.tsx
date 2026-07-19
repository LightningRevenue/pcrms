"use client";

import { useState, useTransition } from "react";
import { List, Megaphone, ChevronDown, Plus, Trash2 } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
};

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

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(() => {
      setCampaigns((prev) => [
        { id: crypto.randomUUID(), name: name.trim(), active: true, createdAt: new Date() },
        ...prev,
      ]);
      setCreating(false);
      setName("");
    });
  }

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"?`)) return;
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Megaphone size={14} strokeWidth={1.75} className="text-pink-400" />
          <span className="font-medium">Campaigns</span>
        </div>
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Campaign name"
              className="px-2.5 py-1 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
            <button
              onClick={handleCreate}
              className="px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-2.5 py-1 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            Create Campaign
          </button>
        )}
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <List size={14} strokeWidth={1.75} />
          All Campaigns
          <span className="text-subtle">· {campaigns.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Megaphone size={24} strokeWidth={1.5} className="text-subtle" />
            <p className="text-[13px] text-subtle mt-3">No campaigns yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-6 px-6 py-3 hover:bg-muted/40 transition-colors group">
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[13px] truncate">{c.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                      c.active ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-subtle"
                    }`}
                  >
                    {c.active ? "Active" : "Paused"}
                  </span>
                </span>
                <span className="text-[12px] text-subtle shrink-0 w-20 text-right">{relativeTime(c.createdAt)}</span>
                <button
                  onClick={(e) => handleDelete(e, c.id, c.name)}
                  title="Delete campaign"
                  className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
