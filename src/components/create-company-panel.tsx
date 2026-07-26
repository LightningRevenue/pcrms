"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { X, Link2, MapPin, Banknote, CalendarDays, UserCircle, Briefcase, Users, Globe2 } from "lucide-react";
import { INDUSTRIES, COUNTRIES, EMPLOYEE_BUCKETS } from "@/lib/firmographics";
import { createCompany } from "@/lib/actions/companies";
import { FieldSection } from "@/components/field-section";

function EditableField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Renders a picker instead of a free-text input. */
  options?: readonly string[];
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle truncate">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none border-b border-border"
        >
          <option value="" className="bg-background text-foreground">
            {placeholder || "Empty"}
          </option>
          {options.map((o) => (
            <option key={o} value={o} className="bg-background text-foreground">
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-subtle"
        />
      )}
    </div>
  );
}

export function CreateCompanyPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [address, setAddress] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createCompany({ name, domain, address, linkedin, annualRevenue, industry, country, employeeCount });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-40 flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="flex-1 min-w-0 bg-transparent text-[13px] font-medium outline-none border-b border-transparent focus:border-border placeholder:text-subtle placeholder:font-normal"
          />
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors shrink-0 ml-2">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide px-1 pb-1">Fields</p>

          <FieldSection title="General">
            <EditableField icon={Link2} label="Domain" value={domain} onChange={setDomain} placeholder="Domain" />
          </FieldSection>

          <FieldSection title="Business">
            <EditableField icon={Banknote} label="Revenue" value={annualRevenue} onChange={setAnnualRevenue} placeholder="Annual revenue" />
            <EditableField icon={Briefcase} label="Industry" value={industry} onChange={setIndustry} placeholder="Industry" options={INDUSTRIES} />
            <EditableField
              icon={Users}
              label="Employees"
              value={employeeCount}
              onChange={setEmployeeCount}
              placeholder="Employee count"
              options={EMPLOYEE_BUCKETS.map((b) => b.label)}
            />
            <EditableField icon={Globe2} label="Country" value={country} onChange={setCountry} placeholder="Country" options={COUNTRIES} />
          </FieldSection>

          <FieldSection title="Contact">
            <EditableField icon={MapPin} label="Address" value={address} onChange={setAddress} placeholder="Address" />
            <EditableField icon={Link2} label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="LinkedIn" />
          </FieldSection>

          <FieldSection title="System">
            <div className="flex items-center gap-2 px-1 py-1.5 text-[13px] text-subtle">
              <CalendarDays size={14} strokeWidth={1.75} />
              <span className="w-28 shrink-0">Creation date</span>
              <span>Created now</span>
            </div>
            <div className="flex items-center gap-2 px-1 py-1.5 text-[13px] text-subtle">
              <UserCircle size={14} strokeWidth={1.75} />
              <span className="w-28 shrink-0">Created by</span>
              <span>{session?.user?.name ?? session?.user?.email ?? "—"}</span>
            </div>
          </FieldSection>

          {error && <p className="px-1 pt-2 text-[12px] text-red-400">{error}</p>}
        </div>

        <div className="h-14 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </>
  );
}
