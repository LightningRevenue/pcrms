"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Upload, X, Trash2, PlugZap, Loader2 } from "lucide-react";
import type { MailboxAccount } from "@prisma/client";
import {
  createMailboxAccount,
  toggleMailboxAccount,
  deleteMailboxAccount,
  importMailboxAccountsCsv,
  listMailboxAccounts,
  checkMailboxAccount,
  checkAllMailboxAccounts,
  type MailboxAccountInput,
} from "@/lib/actions/mailbox-accounts";

const EMPTY_FORM: MailboxAccountInput = {
  label: "",
  email: "",
  smtpHost: "",
  smtpPort: 587,
  imapHost: "",
  imapPort: 993,
  username: "",
  password: "",
};

export function MailboxAccountsManager({ accounts: initial }: { accounts: MailboxAccount[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [checkingAll, setCheckingAll] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCheck(id: string) {
    setCheckingIds((prev) => new Set(prev).add(id));
    const updated = await checkMailboxAccount(id);
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setCheckingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleCheckAll() {
    setCheckingAll(true);
    setCheckingIds(new Set(accounts.map((a) => a.id)));
    const updated = await checkAllMailboxAccounts();
    setAccounts(updated);
    setCheckingIds(new Set());
    setCheckingAll(false);
  }

  function handleCreate(input: MailboxAccountInput) {
    setAddError(null);
    startTransition(async () => {
      try {
        const account = await createMailboxAccount(input);
        setAccounts((prev) => [...prev, account]);
        setAdding(false);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    setImportMsg("Importing…");
    startTransition(async () => {
      try {
        const { imported, skipped } = await importMailboxAccountsCsv(text);
        setAccounts(await listMailboxAccounts());
        setImportMsg(`Imported ${imported} mailbox${imported === 1 ? "" : "es"}${skipped ? `, skipped ${skipped} (duplicate or invalid)` : ""}.`);
      } catch (err) {
        setImportMsg(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleToggle(id: string, active: boolean) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
    startTransition(() => toggleMailboxAccount(id, active));
  }

  function handleDelete(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    startTransition(() => deleteMailboxAccount(id));
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Mailboxes</p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={handleCheckAll}
            disabled={checkingAll || accounts.length === 0}
            className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors disabled:opacity-50"
          >
            {checkingAll ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <PlugZap size={14} strokeWidth={1.75} />
            )}
            Check all
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
          >
            <Upload size={14} strokeWidth={1.75} />
            Import CSV
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} />
            Add mailbox
          </button>
        </div>
      </div>

      {importMsg && <p className="mt-2 text-[12px] text-subtle">{importMsg}</p>}

      <div className="mt-2 border border-border rounded-md overflow-hidden">
        {accounts.map((account) => {
          const checking = checkingIds.has(account.id);
          return (
            <div
              key={account.id}
              className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0 group"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{account.label}</div>
                <div className="text-subtle text-[12px] truncate">{account.email}</div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ConnectionBadge label="SMTP" status={account.smtpStatus} error={account.smtpError} checking={checking} />
                <ConnectionBadge label="IMAP" status={account.imapStatus} error={account.imapError} checking={checking} />
              </div>

              <button
                onClick={() => handleCheck(account.id)}
                disabled={checking}
                className="p-1 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                title="Check connection"
              >
                {checking ? (
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                ) : (
                  <PlugZap size={14} strokeWidth={1.75} />
                )}
              </button>

              <button
                onClick={() => handleToggle(account.id, !account.active)}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors ${
                  account.active
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-subtle"
                }`}
              >
                <span className={`size-1.5 rounded-full ${account.active ? "bg-emerald-400" : "bg-subtle"}`} />
                {account.active ? "Active" : "Disabled"}
              </button>
              <button
                onClick={() => handleDelete(account.id)}
                className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                title="Remove mailbox"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
        {accounts.length === 0 && !adding && (
          <div className="px-3 py-4 text-[13px] text-subtle text-center">No outreach mailboxes connected yet</div>
        )}
      </div>

      {adding && <AddMailboxDialog error={addError} onCancel={() => setAdding(false)} onCreate={handleCreate} />}
    </div>
  );
}

function AddMailboxDialog({
  error,
  onCancel,
  onCreate,
}: {
  error: string | null;
  onCancel: () => void;
  onCreate: (input: MailboxAccountInput) => void;
}) {
  const [form, setForm] = useState<MailboxAccountInput>(EMPTY_FORM);

  function set<K extends keyof MailboxAccountInput>(key: K, value: MailboxAccountInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    if (!form.label.trim() || !form.email.trim() || !form.smtpHost.trim() || !form.imapHost.trim() || !form.username.trim() || !form.password) {
      return;
    }
    onCreate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[26rem] rounded-lg border border-border bg-background shadow-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium">Add outreach mailbox</h2>
          <button onClick={onCancel} className="p-1 text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Label">
            <input
              autoFocus
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="Sales outreach"
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>
          <Field label="Email address">
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="outreach@company.com"
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP host">
              <input
                value={form.smtpHost}
                onChange={(e) => set("smtpHost", e.target.value)}
                placeholder="smtp.example.com"
                className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              />
            </Field>
            <Field label="SMTP port">
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => set("smtpPort", Number(e.target.value))}
                className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              />
            </Field>
            <Field label="IMAP host">
              <input
                value={form.imapHost}
                onChange={(e) => set("imapHost", e.target.value)}
                placeholder="imap.example.com"
                className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              />
            </Field>
            <Field label="IMAP port">
              <input
                type="number"
                value={form.imapPort}
                onChange={(e) => set("imapPort", Number(e.target.value))}
                className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              />
            </Field>
          </div>

          <Field label="Username">
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="Usually same as email"
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>
        </div>

        {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Add mailbox
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectionBadge({
  label,
  status,
  error,
  checking,
}: {
  label: string;
  status: string | null;
  error: string | null;
  checking: boolean;
}) {
  const color = checking
    ? "bg-muted text-subtle"
    : status === "ok"
      ? "bg-emerald-500 text-white"
      : status === "error"
        ? "bg-red-500 text-white"
        : "bg-muted text-subtle";

  return (
    <span
      title={status === "error" ? error ?? undefined : status === "ok" ? `${label} connected` : `${label} not checked yet`}
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-subtle">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
