"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import type { Person, Company } from "@prisma/client";
import { createContact } from "@/lib/actions/contacts";

type PersonWithCompany = Person & { company: Company | null };

export function MobileContactsList({ people }: { people: PersonWithCompany[] }) {
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ").toLowerCase();
      return name.includes(q) || p.email?.toLowerCase().includes(q) || p.company?.name.toLowerCase().includes(q);
    });
  }, [people, query]);

  return (
    <div>
      <div className="sticky top-0 bg-background p-3 border-b border-border flex items-center gap-2 z-10">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <Search size={15} className="text-subtle shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="flex-1 min-w-0 bg-transparent text-[13.5px] focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-lg bg-accent text-white p-2"
          title="Add contact"
        >
          <Plus size={18} />
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="p-4 text-[13px] text-subtle">No contacts found.</p>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((p) => {
            const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
            return (
              <Link
                key={p.id}
                href={`/m/contacts/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-muted transition-colors"
              >
                <span className="size-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-[13px] font-bold text-subtle">
                  {name[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate">{name}</p>
                  <p className="text-[12px] text-subtle truncate">
                    {p.company?.name ?? p.email ?? p.phone ?? "—"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showAdd && <AddContactSheet onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddContactSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await createContact({ firstName, lastName, email, phone });
        router.push(`/m/contacts/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create contact");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl border-t border-border p-4 pb-6 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Add contact</h2>
          <button onClick={onClose}>
            <X size={18} className="text-subtle" />
          </button>
        </div>

        <input
          autoFocus
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[14px] focus:outline-none focus:border-accent"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[14px] focus:outline-none focus:border-accent"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[14px] focus:outline-none focus:border-accent"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          type="tel"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[14px] focus:outline-none focus:border-accent"
        />

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        <button
          onClick={submit}
          disabled={!firstName.trim() || isPending}
          className="w-full rounded-lg bg-accent text-white text-[14px] font-semibold py-2.5 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save contact"}
        </button>
      </div>
    </div>
  );
}
