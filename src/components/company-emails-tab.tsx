import Link from "next/link";
import type { Email, EmailOpen, EmailOpportunity, Opportunity, Person } from "@prisma/client";
import { Eye, User as UserIcon } from "lucide-react";
import { AssociatedDeals } from "@/components/associated-deals";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    date
  );
}

type CompanyEmail = Email & {
  person: Person;
  opens: EmailOpen[];
  opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
};

export function CompanyEmailsTab({ emails }: { emails: CompanyEmail[] }) {
  if (emails.length === 0) {
    return <p className="text-[13px] text-subtle">No emails on this company&apos;s contacts yet.</p>;
  }

  return (
    <div>
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-3">
        Emails across contacts &amp; deals
      </p>
      <div className="space-y-2">
        {emails.map((email) => {
          const deals = email.opportunities.map((o) => o.opportunity);
          const personName = [email.person.firstName, email.person.lastName].filter(Boolean).join(" ");
          return (
            <div key={email.id} className="border border-border rounded-md p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                    email.direction === "sent" ? "bg-blue-950 text-blue-400" : "bg-emerald-950 text-emerald-400"
                  }`}
                >
                  {email.direction === "sent" ? "Sent" : "Received"}
                </span>
                <span className="text-[13px] font-medium truncate flex-1 min-w-0">{email.subject}</span>
                <span className="text-[11px] text-subtle shrink-0">{formatDate(email.sentAt)}</span>
              </div>
              <p className="text-[12px] text-subtle mt-1 truncate">
                From: {email.from} · To: {email.to.join(", ")}
              </p>
              {email.bcc.length > 0 && (
                <p className="text-[12px] text-subtle mt-0.5 truncate">Bcc: {email.bcc.join(", ")}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Link
                  href={`/contacts/${email.person.id}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[11px] text-subtle hover:text-foreground hover:bg-muted/70 transition-colors"
                  title={`Go to ${personName}`}
                >
                  <UserIcon size={11} strokeWidth={1.75} />
                  {personName}
                </Link>
                {deals.length > 0 && <AssociatedDeals opportunities={deals} />}
                {email.direction === "sent" && email.opens.length > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <Eye size={11} strokeWidth={1.75} />
                    {email.opens.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
