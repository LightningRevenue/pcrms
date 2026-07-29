"use client";

import { useState, useTransition } from "react";
import { setRequiredPersonFields } from "@/lib/actions/required-fields";
import { REQUIRABLE_PERSON_FIELDS, type RequiredFieldsConfig } from "@/lib/required-fields";

export function RequiredFieldsManager({ config }: { config: RequiredFieldsConfig }) {
  const [enforced, setEnforced] = useState(config.enforced);
  const [keys, setKeys] = useState<string[]>(config.keys);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: RequiredFieldsConfig) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setRequiredPersonFields(next);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function toggleEnforced(next: boolean) {
    setEnforced(next);
    save({ enforced: next, keys });
  }

  function toggleKey(key: string) {
    const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
    setKeys(next);
    save({ enforced, keys: next });
  }

  const personFields = REQUIRABLE_PERSON_FIELDS.filter((f) => f.on === "person");
  const companyFields = REQUIRABLE_PERSON_FIELDS.filter((f) => f.on === "company");

  return (
    <div className="mt-6">
      <label className="flex items-center gap-2 text-[13px] cursor-pointer">
        <input
          type="checkbox"
          checked={enforced}
          onChange={(e) => toggleEnforced(e.target.checked)}
          className="accent-accent"
        />
        Enforce required fields
      </label>

      <fieldset disabled={!enforced} className={enforced ? "mt-5" : "mt-5 opacity-50"}>
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Contact fields</p>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-[13px] text-subtle">
            <input type="checkbox" checked disabled className="accent-accent" />
            First name
            <span className="text-[11px]">— always required</span>
          </div>
          {personFields.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={keys.includes(f.key)}
                onChange={() => toggleKey(f.key)}
                className="accent-accent"
              />
              {f.label}
            </label>
          ))}
        </div>

        <p className="mt-5 text-[12px] font-medium text-subtle uppercase tracking-wide">Company fields</p>
        <p className="mt-1 text-[12px] text-subtle">
          Asked on the contact form and saved on the contact&apos;s company.
        </p>
        <div className="mt-2 space-y-1.5">
          {companyFields.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={keys.includes(f.key)}
                onChange={() => toggleKey(f.key)}
                className="accent-accent"
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 h-4 text-[12px]">
        {pending && <span className="text-subtle">Saving…</span>}
        {!pending && saved && <span className="text-subtle">Saved</span>}
        {error && <span className="text-red-400">{error}</span>}
      </div>
    </div>
  );
}
