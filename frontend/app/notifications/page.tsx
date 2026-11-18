"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, notificationsApi, Notification } from "@/lib/api";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    async function loadData() {
      try {
        const me = await auth.me(); // Ensure user is logged in
        const data = filter === "all" 
          ? await notificationsApi.list() 
          : await notificationsApi.listUnread();
        setNotifications(data.results);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router, filter]);

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function handleMarkRead(id: number) {
    await notificationsApi.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy">
          Notifications
        </h1>
        <button 
          onClick={handleMarkAllRead}
          className="text-sm font-medium text-pac-navy hover:text-pac-gold"
        >
          Mark all as read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-pac-navy/10">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 text-sm font-medium ${filter === "all" ? "border-b-2 border-pac-gold text-pac-navy" : "text-pac-navy/60"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-2 text-sm font-medium ${filter === "unread" ? "border-b-2 border-pac-gold text-pac-navy" : "text-pac-navy/60"}`}
        >
          Unread
        </button>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white border border-pac-navy/10 rounded-lg p-12 text-center shadow-sm">
          <p className="text-pac-navy/60">No notifications found.</p>
        </div>
      ) : (
        <div className="bg-white border border-pac-navy/10 rounded-lg shadow-sm divide-y divide-pac-navy/10">
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 flex items-start justify-between gap-4 ${!n.is_read ? "bg-pac-cream/30" : ""}`}>
              <div>
                <p className={`text-sm ${!n.is_read ? "font-semibold text-pac-navy" : "text-pac-navy/70"}`}>
                  {n.message}
                </p>
                <p className="text-xs text-pac-navy/40 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-3">
                {!n.is_read && (
                  <button 
                    onClick={() => handleMarkRead(n.id)}
                    className="text-xs text-pac-navy/60 hover:text-pac-gold"
                  >
                    Mark read
                  </button>
                )}
                <Link 
                  href={n.link} 
                  className="text-xs font-medium text-pac-navy hover:text-pac-gold underline"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}