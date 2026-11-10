"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, thesesApi, usersApi, User, Thesis, ApiError } from "@/lib/api";
import AssignCommitteeForm from "@/components/AssignmentCommitteeForm";
import StatusBadge from "@/components/StatusBadge";

export default function AdminPanelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState<number | null>(null);

  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const me = await auth.me();
        
        if (me.role !== "admin" && !me.is_superuser) {
          router.push("/dashboard");
          return;
        }

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

  async function handleApprove(thesisId: number) {
    setProcessingId(thesisId);
    try {
      await thesesApi.reviewProposal(thesisId, "approve");
      const updated = await thesesApi.list();
      setTheses(updated.results);
    } catch (err) {
      alert("Failed to approve.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(thesisId: number) {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }
    setProcessingId(thesisId);
    try {
      await thesesApi.reviewProposal(thesisId, "reject", rejectReason);
      const updated = await thesesApi.list();
      setTheses(updated.results);
      setShowRejectBox(null);
      setRejectReason("");
    } catch (err) {
      alert("Failed to reject.");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div className="p-8 text-center animate-pulse">Loading Admin Panel...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy">
          Admin Panel
        </h1>
        <Link 
          href="/admin-panel/users" 
          className="bg-white border border-pac-navy/20 text-pac-navy px-4 py-2 rounded-md text-sm font-medium hover:bg-pac-cream transition-colors"
        >
          + Manage Users
        </Link>
      </div>
      
      {theses.length === 0 ? (
        <p className="text-pac-navy/60">No theses in the system yet.</p>
      ) : (
        <div className="space-y-4">
          {theses.map((thesis) => (
            <div key={thesis.id} className="bg-white border border-pac-navy/10 rounded-lg p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-4">
                <div>
                  <h2 className="font-semibold text-pac-navy text-lg">{thesis.title}</h2>
                  <p className="text-sm text-pac-navy/60">Student: {thesis.student.full_name} · Dept: {thesis.department}</p>
                </div>
                <StatusBadge status={thesis.status} label={thesis.status_display} />
              </div>
              
              {/* 1. PROPOSAL REVIEW UI (Only if status is proposal) */}
              {thesis.status === "proposal" && (
                <div className="bg-pac-cream/30 p-4 rounded-md border border-pac-navy/10 space-y-3 mb-4">
                  <p className="text-sm font-medium text-pac-navy">Review Proposal</p>
                  
                  {showRejectBox === thesis.id ? (
                    <div className="space-y-2">
                      <textarea 
                        className="w-full text-sm rounded border border-pac-navy/20 p-2"
                        placeholder="Reason for rejection (e.g., Topic is too broad)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(thesis.id)} disabled={processingId === thesis.id} className="bg-red-600 text-white text-sm px-4 py-1.5 rounded">
                          {processingId === thesis.id ? "Rejecting..." : "Confirm Reject"}
                        </button>
                        <button onClick={() => setShowRejectBox(null)} className="text-sm text-pac-navy/60 hover:text-pac-navy">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(thesis.id)} disabled={processingId === thesis.id} className="bg-emerald-600 text-white text-sm px-4 py-1.5 rounded hover:bg-emerald-700">
                        {processingId === thesis.id ? "Approving..." : "Approve Proposal"}
                      </button>
                      <button onClick={() => setShowRejectBox(thesis.id)} className="bg-red-50 text-red-600 border border-red-200 text-sm px-4 py-1.5 rounded hover:bg-red-100">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. COMMITTEE ASSIGNMENT UI (Only if approved/in_progress) */}
              {["in_progress", "under_review", "revisions", "approved", "defended"].includes(thesis.status)&& (
                <AssignCommitteeForm  
                  thesis={thesis} 
                  supervisors={supervisors} 
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}