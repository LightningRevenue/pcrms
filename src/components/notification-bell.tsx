"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Notification } from "@prisma/client";
import { Bell, Mail, X } from "lucide-react";
import { listNotifications, markNotificationsRead, deleteNotification, clearNotifications } from "@/lib/actions/notifications";

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    listNotifications().then(setNotifications);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      if (event.data.startsWith(":")) return;
      try {
        const notification = JSON.parse(event.data) as Notification;
        setNotifications((prev) => [notification, ...prev]);
      } catch {}
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    if (open) {
      const r = triggerRef.current?.getBoundingClientRect();
      const panelWidth = 320;
      if (r) {
        const left = Math.min(r.left, window.innerWidth - panelWidth - 8);
        setRect({ top: r.bottom + 4, left: Math.max(8, left) });
      }
      if (unreadCount > 0) {
        markNotificationsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goTo(link: string | null) {
    if (link) router.push(link);
    setOpen(false);
  }

  function removeOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotification(id);
  }

  function clearAll() {
    setNotifications([]);
    clearNotifications();
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <Bell size={15} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-rose-500" />
        )}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: rect.top, left: rect.left }}
            className="fixed z-[100] w-80 rounded-md border border-border bg-background shadow-lg"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[13px] font-medium">Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[12px] text-subtle hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-[13px] text-subtle text-center">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => goTo(n.link)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer group"
                  >
                    <Mail size={15} strokeWidth={1.75} className="text-blue-400 shrink-0 mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] truncate">{n.title}</span>
                      {n.body && (
                        <span className="block text-[12px] text-subtle truncate">{n.body}</span>
                      )}
                      <span className="block text-[11px] text-subtle mt-0.5">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className="size-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />}
                    <button
                      onClick={(e) => removeOne(e, n.id)}
                      title="Delete notification"
                      className="p-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                    >
                      <X size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
