"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { ApiKey } from "@prisma/client";
import { createApiKey, revokeApiKey } from "@/lib/actions/api-keys";

export function ApiKeysForm({ keys, canManage }: { keys: ApiKey[]; canManage: boolean }) {
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const token = await createApiKey(name);
      setNewToken(token);
      setName("");
    });
  }

  function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? Any integration using it will stop working immediately.")) return;
    startTransition(() => revokeApiKey(id));
  }

  return (
    <div className="mt-6 max-w-2xl space-y-4">
      {newToken && (
        <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-[13px]">
          <p className="font-medium">Save this key now — it won&apos;t be shown again.</p>
          <code className="block mt-1 text-[12px] break-all">{newToken}</code>
        </div>
      )}

      {canManage && (
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. Zapier)"
            className="flex-1 text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
          />
          <button
            onClick={handleCreate}
            disabled={pending || !name.trim()}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create key"}
          </button>
        </div>
      )}

      <div className="divide-y divide-border border border-border rounded-md">
        {keys.length === 0 && <p className="text-[13px] text-subtle px-3 py-3">No API keys yet.</p>}
        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="text-[13px]">{key.name}</p>
              <p className="text-[12px] text-subtle">
                •••• {key.tokenLast4} · created {key.createdAt.toLocaleDateString()}
                {key.lastUsedAt && ` · last used ${key.lastUsedAt.toLocaleDateString()}`}
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => handleRevoke(key.id)}
                disabled={pending}
                className="p-1.5 text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                title="Revoke"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
