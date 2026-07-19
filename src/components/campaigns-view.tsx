"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { List, Megaphone, ChevronDown, Plus, Trash2 } from "lucide-react";
import { createCampaign, deleteCampaign } from "@/lib/actions/campaigns";

type Campaign = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  createdBy: { name: string | null; email: string | null } | null;
  _count: { members: number };
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

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-subtle",
  active: "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent",
  sent: "bg-muted text-subtle",
};

export function CampaignsView({ campaigns }: { campaigns: Campaign[] }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (!name.trim()) return;
    const trimmed = name.trim();
    startTransition(async () => {
      const campaign = await createCampaign(trimmed);
      setCreating(false);
      setName("");
      router.push(`/marketing/campaigns/${campaign.id}`);
    });
  }

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"?`)) return;
    startTransition(async () => {
      await deleteCampaign(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Megaphone size={14} strokeWidth={1.5} className="text-subtle" />
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
              disabled={pending}
              className="px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-60"
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
          <List size={14} strokeWidth={1.5} />
          All Campaigns
          <span className="text-subtle">· {campaigns.length}</span>
          <ChevronDown size={13} strokeWidth={1.5} />
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
              <a
                key={c.id}
                href={`/marketing/campaigns/${c.id}`}
                className="flex items-center gap-6 px-6 py-3 hover:bg-muted/40 transition-colors group"
              >
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[13px] truncate">{c.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0 capitalize ${
                      STATUS_STYLE[c.status] ?? STATUS_STYLE.draft
                    }`}
                  >
                    {c.status}
                  </span>
                </span>
                <span className="text-[12px] text-subtle shrink-0 w-24 text-right">
                  {c._count.members} member{c._count.members === 1 ? "" : "s"}
                </span>
                <span className="text-[12px] text-subtle shrink-0 w-20 text-right">{relativeTime(c.createdAt)}</span>
                <button
                  onClick={(e) => handleDelete(e, c.id, c.name)}
                  title="Delete campaign"
                  className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
