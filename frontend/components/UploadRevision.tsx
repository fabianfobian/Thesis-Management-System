"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { thesesApi } from "@/lib/api";

export default function UploadRevision({ chapterId, hasVersions }: { chapterId: number, hasVersions: boolean }) {
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
      setFile(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="mt-4 p-4 border border-pac-navy/10 rounded-lg bg-white space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-pac-navy mb-2">
          {hasVersions ? "Upload a New Revision" : "Submit Your Chapter"}
        </h4>
        <p className="text-xs text-pac-navy/60 mb-4">
          {hasVersions 
            ? "Upload a revised version of this chapter for supervisor review." 
            : "Upload your initial draft for this chapter. Accepted formats: PDF, DOCX, DOC."}
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm text-pac-navy/70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pac-navy/10 file:text-pac-navy hover:file:bg-pac-navy/20"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
            hasVersions ? "bg-pac-navy hover:bg-pac-navyLight" : "bg-pac-gold hover:bg-pac-goldLight"
          }`}
        >
          {uploading ? "Uploading..." : hasVersions ? "Upload Revision" : "Submit Chapter"}
        </button>
      </div>
      {error && <span className="text-sm text-red-600 block">{error}</span>}
    </form>
  );
}