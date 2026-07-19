function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function TrendChart({ data, label }: { data: { date: Date; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div>
      <div className="flex items-end gap-2 h-20">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
            <span className="text-[11px] text-subtle tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {d.count}
            </span>
            <div className="w-full flex items-end h-12">
              <div
                className="w-full rounded-t bg-[#2a78d6] dark:bg-[#3987e5] transition-all"
                style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-subtle">{formatDay(d.date)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-subtle mt-1">{label}</p>
    </div>
  );
}
