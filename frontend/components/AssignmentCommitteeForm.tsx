"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { thesesApi, User, Thesis } from "@/lib/api";

export default function AssignCommitteeForm({ thesis, supervisors }: { thesis: Thesis, supervisors: User[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
      router.refresh();
    } catch (err) {
      alert("Failed to assign committee.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-pac-cream/30 p-4 rounded-md border border-pac-navy/10 flex flex-col sm:flex-row gap-4 items-end">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-pac-navy/70 mb-1">Main Supervisor</label>
        <select
          value={formData.supervisor_id}
          onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
          className="w-full rounded border border-pac-navy/20 p-2 text-sm"
        >
          <option value="">-- Select --</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>
      
      <div className="flex-1">
        <label className="block text-xs font-semibold text-pac-navy/70 mb-1">Co-Supervisor</label>
        <select
          value={formData.co_supervisor_id}
          onChange={(e) => setFormData({ ...formData, co_supervisor_id: e.target.value })}
          className="w-full rounded border border-pac-navy/20 p-2 text-sm"
        >
          <option value="">-- Select --</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-xs font-semibold text-pac-navy/70 mb-1">Third Reader</label>
        <select
          value={formData.third_reader_id}
          onChange={(e) => setFormData({ ...formData, third_reader_id: e.target.value })}
          className="w-full rounded border border-pac-navy/20 p-2 text-sm"
        >
          <option value="">-- Select --</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-pac-navy px-4 py-2 text-sm font-semibold text-white hover:bg-pac-navyLight disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "Saving..." : "Assign"}
      </button>
    </form>
  );
}