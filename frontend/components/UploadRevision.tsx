"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { thesesApi } from "@/lib/api";

export default function UploadRevision({ chapterId }: { chapterId: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await thesesApi.uploadVersion(chapterId, file);
      setFile(null); // Reset the input
      router.refresh(); // Refetch the server component to show the new version
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="text-sm text-pac-navy/70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pac-navy/10 file:text-pac-navy hover:file:bg-pac-navy/20"
      />
      <button
        type="submit"
        disabled={!file || uploading}
        className="rounded-md bg-pac-gold px-4 py-2 text-sm font-semibold text-white hover:bg-pac-goldLight disabled:opacity-50 transition-colors"
      >
        {uploading ? "Uploading..." : "Upload New Version"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}