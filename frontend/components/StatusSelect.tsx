"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { thesesApi, ThesisStatus } from "@/lib/api";

const STATUS_OPTIONS: { value: ThesisStatus; label: string }[] = [
  { value: "proposal", label: "Proposal submitted" },
  { value: "in_progress", label: "In progress" },
  { value: "under_review", label: "Under review" },
  { value: "revisions", label: "Revisions required" },
  { value: "approved", label: "Approved" },
  { value: "defended", label: "Defended" },
  { value: "archived", label: "Archived" },
];

export default function StatusSelect({
  thesisId,
  currentStatus,
}: {
  thesisId: number;
  currentStatus: ThesisStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as ThesisStatus;
    setLoading(true);
    try {
      await thesesApi.setStatus(thesisId, newStatus);
      router.refresh(); // Refetch the server component to update the UI
    } catch (err) {
      alert("Failed to update status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={loading}
      className="text-sm border border-pac-navy/20 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-pac-gold disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
