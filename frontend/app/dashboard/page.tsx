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
          {theses.map((t) => (
            <li key={t.id}>
              <Link
                href={`/theses/${t.id}`}
                className="block rounded-lg border border-pac-navy/10 bg-white p-5 hover:border-pac-gold transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-pac-navy text-lg">{t.title}</h2>
                    <p className="text-sm text-pac-navy/60 mt-1">
                      Student: <span className="font-medium text-pac-navy">{t.student.full_name}</span> · 
                      Supervisor: <span className="font-medium text-pac-navy">{t.supervisor?.full_name ?? "Unassigned"}</span>
                    </p>
                  </div>
                  <StatusBadge status={t.status} label={t.status_display} />
                </div>
              </Link>
            </li>
          ))}
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