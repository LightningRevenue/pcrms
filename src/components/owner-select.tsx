"use client";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

export function OwnerSelect({
  users,
  ownerId,
  onChange,
}: {
  users: WorkspaceUser[];
  ownerId: string | null;
  onChange: (ownerId: string | null) => void;
}) {
  return (
    <select
      value={ownerId ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="flex-1 min-w-0 bg-transparent text-[13px] outline-none cursor-pointer"
    >
      <option value="" className="bg-background text-foreground">
        Unassigned
      </option>
      {users.map((u) => (
        <option key={u.id} value={u.id} className="bg-background text-foreground">
          {u.name ?? u.email ?? "Unknown"}
        </option>
      ))}
    </select>
  );
}
