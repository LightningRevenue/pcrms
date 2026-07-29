"use client";

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { X, Mail, Phone, Building2, Briefcase, Link2, CalendarDays, UserCircle, Factory, Globe, Users, DollarSign } from "lucide-react";
import { createContact } from "@/lib/actions/contacts";
import { FieldSection } from "@/components/field-section";
import {
  activeRequiredFields,
  missingRequiredFields,
  requiredFieldsError,
  REQUIRED_FIELDS_OFF,
  type RequiredFieldsConfig,
} from "@/lib/required-fields";
import { getRequiredPersonFields } from "@/lib/actions/required-fields";

function EditableField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle truncate">
        <Icon size={14} strokeWidth={1.75} />
        {label}
        {required && <span className="text-red-400" title="Required">*</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-subtle"
      />
    </div>
  );
}

export function CreateContactPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  // Fetched here rather than drilled through ContactsView — the panel is the only consumer, and
  // it mounts only when the user actually opens it. Save is validated server-side regardless,
  // so a slow fetch can't let an invalid contact through.
  const [requiredFields, setRequiredFields] = useState<RequiredFieldsConfig>(REQUIRED_FIELDS_OFF);
  useEffect(() => {
    getRequiredPersonFields().then(setRequiredFields).catch(() => {});
  }, []);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const values = { firstName, lastName, email, phone, company, jobTitle, linkedin, industry, country, employeeCount, annualRevenue };
  const isRequired = (key: string) => activeRequiredFields(requiredFields).some((f) => f.key === key);
  // Company fields only make sense once there's a company to attach them to — createContact can
  // also derive one from the email domain, so the section shows whenever either is present.
  const showCompanySection =
    activeRequiredFields(requiredFields).some((f) => f.on === "company");

  function handleSave() {
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    const missing = missingRequiredFields(values, requiredFields);
    if (missing.length > 0) {
      setError(requiredFieldsError(missing));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createContact(values);
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
          <div className="flex items-center gap-2 min-w-0">
            <input
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-28 bg-transparent text-[13px] font-medium outline-none border-b border-transparent focus:border-border placeholder:text-subtle placeholder:font-normal"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={isRequired("lastName") ? "Last name *" : "Last name"}
              className="w-28 bg-transparent text-[13px] font-medium outline-none border-b border-transparent focus:border-border placeholder:text-subtle placeholder:font-normal"
            />
          </div>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors shrink-0">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide px-1 pb-1">Fields</p>

          <FieldSection title="General">
            <EditableField icon={Mail} label="Email" value={email} onChange={setEmail} placeholder="Email" required={isRequired("email")} />
            <EditableField icon={Phone} label="Phone" value={phone} onChange={setPhone} placeholder="Phone" required={isRequired("phone")} />
          </FieldSection>

          <FieldSection title="Work">
            <EditableField icon={Building2} label="Company" value={company} onChange={setCompany} placeholder="Company" required={isRequired("company")} />
            <EditableField icon={Briefcase} label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="Job title" required={isRequired("jobTitle")} />
          </FieldSection>

          {showCompanySection && (
            <FieldSection title="Company details">
              <p className="px-1 pb-1 text-[12px] text-subtle">Saved on the contact&apos;s company.</p>
              {isRequired("industry") && (
                <EditableField icon={Factory} label="Industry" value={industry} onChange={setIndustry} placeholder="Industry" required />
              )}
              {isRequired("country") && (
                <EditableField icon={Globe} label="Country" value={country} onChange={setCountry} placeholder="Country" required />
              )}
              {isRequired("employeeCount") && (
                <EditableField icon={Users} label="Employees" value={employeeCount} onChange={setEmployeeCount} placeholder="e.g. 120" required />
              )}
              {isRequired("annualRevenue") && (
                <EditableField icon={DollarSign} label="Revenue" value={annualRevenue} onChange={setAnnualRevenue} placeholder="e.g. $5M" required />
              )}
            </FieldSection>
          )}

          <FieldSection title="Social">
            <EditableField icon={Link2} label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="LinkedIn" required={isRequired("linkedin")} />
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
