"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commentsApi } from "@/lib/api";

export default function CommentForm({ chapterId }: { chapterId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await commentsApi.create(chapterId, body);
      setBody(""); // Clear form
      router.refresh(); // Refresh server component to show new comment
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave your feedback on this chapter..."
        rows={3}
        className="w-full text-sm rounded-md border border-pac-navy/20 p-3 focus:outline-none focus:ring-2 focus:ring-pac-gold"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!body.trim() || loading}
          className="rounded-md bg-pac-navy px-4 py-2 text-sm font-semibold text-white hover:bg-pac-navyLight disabled:opacity-50 transition-colors"
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}