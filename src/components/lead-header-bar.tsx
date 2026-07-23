"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { deleteContacts } from "@/lib/actions/contacts";

// Minimal header for /lead/[id] — just breadcrumb, favorite, and delete. Everything else
// (email/call/task/note/convert/sequence) lives in LeadQuickActions on the left column instead.
export function LeadHeaderBar({
  contactId,
  name,
  index,
  total,
  isFavorited,
}: {
  contactId: string;
  name: string;
  index: number;
  total: number;
  isFavorited: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startDelete(async () => {
      const { deleted } = await deleteContacts([contactId]);
      if (deleted === 0) {
        alert("Can't delete this contact — it has an associated opportunity. Remove that first.");
        return;
      }
      router.push("/contacts");
    });
  }

  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
      <div className="flex items-center gap-1.5 text-[13px] text-subtle">
        <Link href="/contacts" className="hover:text-foreground transition-colors">
          People
        </Link>
        <span>/</span>
        <span className="text-foreground">{name}</span>
        <span className="ml-1">
          ({index}/{total})
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <FavoriteButton
          entityType="person"
          entityId={contactId}
          name={name}
          href={`/lead/${contactId}`}
          initialFavorited={isFavorited}
        />
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <MoreHorizontal size={14} strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 border border-border rounded-md bg-surface shadow-lg z-20 py-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-red-400 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
