"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, thesesApi, User, Thesis, ApiError } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        // The browser automatically sends the session cookie to Django
        const me = await auth.me();
        const data = await thesesApi.list();
        setUser(me);
        setTheses(data.results);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  // Calculate the stats for the Analytics Cards
  const totalTheses = theses.length;
  const pendingTheses = theses.filter(t => ["proposal", "under_review", "in_progress"].includes(t.status)).length;
  const completedTheses = theses.filter(t => ["approved", "defended"].includes(t.status)).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <p className="text-sm text-pac-navy/60">
          Welcome back, {user.full_name || user.username}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy mt-1">
          {user.role === "student"
            ? "My Thesis"
            : user.role === "supervisor"
            ? "Theses I Supervise"
            : "All Theses"}
        </h1>
      </div>

      {/* Analytics Cards (Only show for supervisors and admins) */}
      {user.role !== "student" && theses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-pac-navy/10 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Total Theses</p>
            <p className="text-3xl font-bold text-pac-navy">{totalTheses}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider mb-1">Action Required</p>
            <p className="text-3xl font-bold text-amber-800">{pendingTheses}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-emerald-800/60 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-3xl font-bold text-emerald-800">{completedTheses}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {user.role === "student" && theses.length === 0 ? (
        <div className="rounded-lg border border-pac-navy/10 bg-white p-12 text-center shadow-sm mt-6">
          <p className="font-[family-name:var(--font-display)] text-xl text-pac-navy mb-2">
            You have not submitted a proposal yet.
          </p>
          <p className="text-pac-navy/60 text-sm mb-6">
            Start your thesis journey by submitting your initial proposal to the department.
          </p>
          <Link
            href="/propose"
            className="inline-block rounded-md bg-pac-gold px-6 py-3 text-sm font-semibold text-white hover:bg-pac-goldLight transition-colors"
          >
            Submit Thesis Proposal
          </Link>
        </div>
      ) : theses.length === 0 ? (
        <div className="rounded-lg border border-pac-navy/10 bg-white p-8 text-center mt-6">
          <p className="font-[family-name:var(--font-display)] text-xl text-pac-navy">
            No theses yet
          </p>
          <p className="text-pac-navy/60 text-sm mt-2">
            Theses assigned to you will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4 mt-6">
          {theses.map((t) => {
            const isRejected = t.status === "rejected";
            
            return (
              <li key={t.id}>
                <div className={`block rounded-lg border p-5 shadow-sm transition-colors ${
                  isRejected 
                    ? "border-red-200 bg-red-50" 
                    : "border-pac-navy/10 bg-white hover:border-pac-gold"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className={`font-semibold text-lg ${isRejected ? "text-red-900" : "text-pac-navy"}`}>
                        {t.title}
                      </h2>
                      <p className={`text-sm mt-1 ${isRejected ? "text-red-700/60" : "text-pac-navy/60"}`}>
                        Student: <span className="font-medium">{t.student.full_name}</span> · 
                        Supervisor: <span className="font-medium">{t.supervisor?.full_name ?? "Unassigned"}</span>
                      </p>
                      
                      {/* Show rejection reason if rejected */}
                      {isRejected && t.rejection_reason && (
                        <div className="mt-4 p-3 bg-white/60 rounded border border-red-200 text-sm text-red-800">
                          <strong>Reason for rejection:</strong> {t.rejection_reason}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      <StatusBadge status={t.status} label={t.status_display} />
                      
                      {isRejected ? (
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            if (confirm("Are you sure? This will delete your rejected proposal so you can start fresh.")) {
                              await thesesApi.discard(t.id);
                              window.location.reload(); // Refresh to show the "Submit Proposal" button
                            }
                          }}
                          className="text-sm font-medium bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
                        >
                          Discard Proposal
                        </button>
                      ) : (
                        <Link
                          href={`/theses/${t.id}`}
                          className="text-sm font-medium text-pac-navy hover:text-pac-gold underline decoration-pac-gold/30"
                        >
                          View Thesis
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-pac-navy/10 rounded"></div>
        <div className="h-8 w-48 bg-pac-navy/20 rounded"></div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-pac-navy/10 bg-white/50"></div>
        ))}
      </div>
    </div>
  );
}