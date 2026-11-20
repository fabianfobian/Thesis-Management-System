"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { thesesApi, User, Thesis } from "@/lib/api";

export default function AssignCommitteeForm({ thesis, supervisors }: { thesis: Thesis, supervisors: User[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Track whether we are in edit mode. 
  // If a supervisor is already assigned, start in view mode (false). Otherwise, start in edit mode (true).
  const [isEditing, setIsEditing] = useState(!thesis.supervisor);

  const [formData, setFormData] = useState({
    supervisor_id: thesis.supervisor?.id || "",
    co_supervisor_id: thesis.co_supervisor?.id || "",
    third_reader_id: thesis.third_reader?.id || "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await thesesApi.assignCommittee(thesis.id, {
        supervisor_id: formData.supervisor_id ? Number(formData.supervisor_id) : undefined,
        co_supervisor_id: formData.co_supervisor_id ? Number(formData.co_supervisor_id) : undefined,
        third_reader_id: formData.third_reader_id ? Number(formData.third_reader_id) : undefined,
      });
      setIsEditing(false); // Switch back to view mode after saving
      router.refresh();
    } catch (err) {
      alert("Failed to assign committee.");
    } finally {
      setLoading(false);
    }
  }

  // Helper to filter out already-selected supervisors
  const getAvailableSupervisors = (currentSelection: string) => {
    return supervisors.filter(s => {
      const isSelectedElsewhere = 
        (formData.supervisor_id === String(s.id) && currentSelection !== "supervisor") ||
        (formData.co_supervisor_id === String(s.id) && currentSelection !== "co_supervisor") ||
        (formData.third_reader_id === String(s.id) && currentSelection !== "third_reader");
      
      return !isSelectedElsewhere;
    });
  };

  // --- VIEW MODE ---
  if (!isEditing) {
    return (
      <div className="bg-white p-4 rounded-md border border-pac-navy/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Main Supervisor</p>
            <p className="font-medium text-pac-navy">{thesis.supervisor?.full_name || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Co-Supervisor</p>
            <p className="font-medium text-pac-navy">{thesis.co_supervisor?.full_name || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Third Reader</p>
            <p className="font-medium text-pac-navy">{thesis.third_reader?.full_name || "Unassigned"}</p>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="bg-white border border-pac-navy/20 text-pac-navy px-4 py-2 rounded-md text-sm font-medium hover:bg-pac-cream transition-colors whitespace-nowrap"
        >
          Change Committee
        </button>
      </div>
    );
  }

  // --- EDIT MODE ---
  return (
    <form onSubmit={handleSubmit} className="bg-pac-cream/30 p-4 rounded-md border border-pac-navy/10 flex flex-col lg:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="block text-xs font-semibold text-pac-navy/70 mb-1">Main Supervisor</label>
        <select
          value={formData.supervisor_id}
          onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
          className="w-full rounded border border-pac-navy/20 p-2 text-sm focus:ring-2 focus:ring-pac-gold focus:outline-none"
        >
          <option value="">-- Select --</option>
          {getAvailableSupervisors("supervisor").map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>
      
      <div className="flex-1 w-full">
        <label className="block text-xs font-semibold text-pac-navy/70 mb-1">Co-Supervisor</label>
        <select
          value={formData.co_supervisor_id}
          onChange={(e) => setFormData({ ...formData, co_supervisor_id: e.target.value })}
          className="w-full rounded border border-pac-navy/20 p-2 text-sm focus:ring-2 focus:ring-pac-gold focus:outline-none"
        >
          <option value="">-- Select --</option>
          {getAvailableSupervisors("co_supervisor").map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 w-full">
        <label className="block text-xs font-semibold text-pac-navy/70 mb-1">Third Reader</label>
        <select
          value={formData.third_reader_id}
          onChange={(e) => setFormData({ ...formData, third_reader_id: e.target.value })}
          className="w-full rounded border border-pac-navy/20 p-2 text-sm focus:ring-2 focus:ring-pac-gold focus:outline-none"
        >
          <option value="">-- Select --</option>
          {getAvailableSupervisors("third_reader").map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 w-full lg:w-auto">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 lg:flex-none rounded bg-pac-navy px-4 py-2 text-sm font-semibold text-white hover:bg-pac-navyLight disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Saving..." : "Save Committee"}
        </button>
        
        {/* Only show cancel if a committee already exists */}
        {thesis.supervisor && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="flex-1 lg:flex-none rounded bg-white border border-pac-navy/20 px-4 py-2 text-sm font-semibold text-pac-navy hover:bg-gray-50 whitespace-nowrap"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}