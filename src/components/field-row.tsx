export function FieldRow({
  icon: Icon,
  label,
  value,
  muted,
  placeholder,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  muted?: boolean;
  placeholder?: string;
}) {
  const empty = !value && placeholder;
  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle truncate">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      <span className={`text-[13px] truncate ${empty ? "text-subtle" : muted ? "text-subtle" : ""}`}>
        {value || placeholder}
      </span>
    </div>
  );
}
