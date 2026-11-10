"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { thesesApi, ApiError } from "@/lib/api";
import Link from "next/link";

export default function ProposePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ title: "", abstract: ""});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await thesesApi.createProposal(formData);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to submit proposal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-pac-navy/60 hover:text-pac-gold">
          ← Back to Dashboard
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy mt-2">
          Submit Thesis Proposal
        </h1>
        <p className="text-pac-navy/60 text-sm mt-1">
          Once submitted, the HOD will assign your supervisory committee.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-pac-navy/10 rounded-lg p-6 shadow-sm space-y-4">
        
        <div>
          <label className="block text-sm font-medium text-pac-navy mb-1">Thesis Title</label>
          <input
            required
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-md border border-pac-navy/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pac-gold"
            placeholder="A study on..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-pac-navy mb-1">Abstract</label>
          <textarea
            required
            rows={6}
            value={formData.abstract}
            onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
            className="w-full rounded-md border border-pac-navy/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pac-gold"
            placeholder="Briefly describe your research..."
          />
        </div>
        
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
        
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-pac-navy text-white py-2.5 font-medium hover:bg-pac-navyLight transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Proposal"}
        </button>
      </form>
    </div>
  );
}