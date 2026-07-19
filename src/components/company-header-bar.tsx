import Link from "next/link";
import { Mail, ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";

export function CompanyHeaderBar({
  companyId,
  name,
  index,
  total,
  isFavorited,
}: {
  companyId: string;
  name: string;
  index: number;
  total: number;
  isFavorited: boolean;
}) {
  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
      <div className="flex items-center gap-1.5 text-[13px] text-subtle">
        <Link href="/companies" className="hover:text-foreground transition-colors">
          Companies
        </Link>
        <span>/</span>
        <span className="text-foreground">{name}</span>
        <span className="ml-1">
          ({index}/{total})
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors">
          <Mail size={14} strokeWidth={1.75} />
          Send Email
        </button>
        <FavoriteButton
          entityType="company"
          entityId={companyId}
          name={name}
          href={`/companies/${companyId}`}
          initialFavorited={isFavorited}
        />
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <ChevronUp size={14} strokeWidth={1.75} />
        </button>
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <ChevronDown size={14} strokeWidth={1.75} />
        </button>
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <MoreHorizontal size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
