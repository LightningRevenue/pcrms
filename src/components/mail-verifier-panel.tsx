"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { guessEmail, createContactFromGuess, type EmailGuessAttempt } from "@/lib/actions/email-guess";

export function MailVerifierPanel() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");
  const [attempts, setAttempts] = useState<EmailGuessAttempt[]>([]);
  const [found, setFound] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [creating, startCreate] = useTransition();

  function search() {
    setError(null);
    setCreatedId(null);
    startSearch(async () => {
      try {
        const result = await guessEmail(firstName, lastName, domain);
        setAttempts(result.attempts);
        setFound(result.found);
        setSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      }
    });
  }

  function createContact() {
    if (!found) return;
    startCreate(async () => {
      try {
        const id = await createContactFromGuess(firstName, lastName, found);
        setCreatedId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create contact");
      }
    });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors"
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="company.com"
          className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors"
        />
      </div>

      <button
        onClick={search}
        disabled={searching || !firstName.trim() || !domain.trim()}
        className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
      >
        {searching && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
        {searching ? "Guessing…" : "Find email"}
      </button>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      {searched && !searching && (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="divide-y divide-border">
            {attempts.map((a) => (
              <div key={a.email} className="flex items-center gap-2.5 px-3 py-2">
                {a.valid && !a.catchAll ? (
                  <CheckCircle2 size={14} strokeWidth={1.75} className="text-green-600 shrink-0" />
                ) : (
                  <XCircle size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
                )}
                <span className="text-[13px] font-mono">{a.email}</span>
                <span className="ml-auto text-[12px] text-subtle">{a.catchAll ? "catch-all" : a.reason}</span>
              </div>
            ))}
          </div>

          <div className="px-3 py-3 border-t border-border">
            {found ? (
              createdId ? (
                <a
                  href={`/contacts/${createdId}`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-green-600 font-medium"
                >
                  Contact created <ArrowRight size={13} strokeWidth={2} />
                </a>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px]">
                    Found: <span className="font-mono font-medium">{found}</span>
                  </span>
                  <button
                    onClick={createContact}
                    disabled={creating}
                    className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {creating ? "Creating…" : "Create Contact"}
                  </button>
                </div>
              )
            ) : (
              <p className="text-[13px] text-subtle">No deliverable pattern found for this name/domain.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
