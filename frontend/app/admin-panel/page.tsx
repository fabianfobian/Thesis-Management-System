"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, thesesApi, usersApi, User, Thesis, ApiError } from "@/lib/api";
import AssignCommitteeForm from "@/components/AssignmentCommitteeForm";

export default function AdminPanelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch user session
        const me = await auth.me();
        
        // Kick out non-admins
        if (me.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        // Fetch data in parallel
        const [thesesRes, supRes] = await Promise.all([
          thesesApi.list(),
          usersApi.listSupervisors()
        ]);

        setUser(me);
        setTheses(thesesRes.results);
        setSupervisors(supRes.results);
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
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-pac-navy/20 rounded"></div>
        <div className="h-32 bg-white rounded-lg"></div>
        <div className="h-32 bg-white rounded-lg"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy">
        Admin Panel: Committee Assignment
      </h1>
      <Link 
          href="/admin-panel/users" 
          className="bg-white border border-pac-navy/20 text-pac-navy px-4 py-2 rounded-md text-sm font-medium hover:bg-pac-cream transition-colors"
        >
          + Manage Users
      </Link>
      
      {theses.length === 0 ? (
        <p className="text-pac-navy/60">No theses in the system yet.</p>
      ) : (
        <div className="space-y-4">
          {theses.map((thesis) => (
            <div key={thesis.id} className="bg-white border border-pac-navy/10 rounded-lg p-6 shadow-sm">
              <h2 className="font-semibold text-pac-navy text-lg">{thesis.title}</h2>
              <p className="text-sm text-pac-navy/60 mb-4">Student: {thesis.student.full_name}</p>
              
              <AssignCommitteeForm 
                thesis={thesis} 
                supervisors={supervisors} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}