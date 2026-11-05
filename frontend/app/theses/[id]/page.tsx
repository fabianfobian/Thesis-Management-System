"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, thesesApi, User, Thesis, ApiError } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import StatusSelect from "@/components/StatusSelect";
import UploadRevision from "@/components/UploadRevision";
import CommentForm from "@/components/CommentForm";
import DocumentViewerToggle from "@/components/DocumentViewerToggle";

export default function ThesisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch user and thesis in parallel in the browser
        const [me, thesisData] = await Promise.all([
          auth.me(),
          thesesApi.retrieve(Number(params.id))
        ]);
        setUser(me);
        setThesis(thesisData);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          router.push("/login");
        } else if (err instanceof ApiError && err.status === 404) {
          router.push("/dashboard"); // Thesis not found, go back
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id, router]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!user || !thesis) return null;

  const canChangeStatus = user.role === "supervisor" || user.role === "admin";

  return (
    <div className="space-y-8">
      {/* Header Breadcrumb */}
      <div>
        <Link href="/dashboard" className="text-sm text-pac-navy/60 hover:text-pac-gold">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Thesis Info */}
      <div className="bg-white border border-pac-navy/10 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-pac-gold font-semibold mb-1">
              {thesis.department}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-pac-navy">
              {thesis.title}
            </h1>

            <div className="text-sm text-pac-navy/60 mt-2 space-y-1">
              <p>Student: <span className="font-medium text-pac-navy">{thesis.student.full_name}</span></p>
              <p>Main Supervisor: <span className="font-medium text-pac-navy">{thesis.supervisor?.full_name ?? "Unassigned"}</span></p>
              <p>Co-Supervisor: <span className="font-medium text-pac-navy">{thesis.co_supervisor?.full_name ?? "Unassigned"}</span></p>
              <p>Third Reader: <span className="font-medium text-pac-navy">{thesis.third_reader?.full_name ?? "Unassigned"}</span></p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={thesis.status} label={thesis.status_display} />
            {canChangeStatus && (
              <StatusSelect thesisId={thesis.id} currentStatus={thesis.status} />
            )}
          </div>
        </div>

        {thesis.abstract && (
          <div className="mt-4 pt-4 border-t border-pac-navy/10">
            <h3 className="text-sm font-semibold text-pac-navy mb-2">Abstract</h3>
            <p className="text-sm text-pac-navy/80 leading-relaxed">{thesis.abstract}</p>
          </div>
        )}
      </div>

      {/* Chapters */}
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-pac-navy mb-4">
          Chapters
        </h2>
        
        {thesis.chapters.length === 0 ? (
          <p className="text-sm text-pac-navy/60">No chapters submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {thesis.chapters.map((chapter) => (
              <div key={chapter.id} className="bg-white border border-pac-navy/10 rounded-lg overflow-hidden shadow-sm">
                <div className="p-4 sm:p-6 bg-pac-cream/50 border-b border-pac-navy/10 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-pac-navy/50 uppercase tracking-wider">
                      Chapter {chapter.number}
                    </span>
                    <h3 className="text-lg font-semibold text-pac-navy mt-1">{chapter.title}</h3>
                  </div>
                  <StatusBadge status={chapter.status} label={chapter.status_display} />
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  {chapter.content && (
                    <p className="text-sm text-pac-navy/80 whitespace-pre-wrap">{chapter.content}</p>
                  )}
                  
                  <div className="mt-4 border-t border-pac-navy/10 pt-4">
                    <h4 className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-3">
                      Submitted Files
                    </h4>
                    {chapter.versions.length === 0 ? (
                      <p className="text-sm text-pac-navy/50 italic">No files uploaded yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {chapter.versions.map((v) => {
                          const fileName = v.document_url?.split("?")[0].split("/").pop() || "document.pdf";
                          return (
                            <li key={v.id} className="flex flex-col text-sm bg-pac-cream/30 p-3 rounded mb-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-pac-navy">Version {v.version_number}</span>
                                <span className="text-pac-navy/50 text-xs">{new Date(v.uploaded_at).toLocaleDateString()}</span>
                                <a href={v.document_url} target="_blank" rel="noreferrer" className="text-pac-navy font-medium hover:text-pac-gold underline decoration-pac-gold/30">
                                  Download
                                </a>
                              </div>
                              {v.document_url && (
                                <DocumentViewerToggle fileUrl={v.document_url} fileName={fileName} versionNumber={v.version_number} />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {user.role === "student" && (
                    <UploadRevision chapterId={chapter.id} />
                  )}

                  <div className="mt-6 pt-4 border-t border-pac-navy/10 space-y-3">
                    <h4 className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-3">
                      Feedback
                    </h4>
                    
                    {chapter.comments.length === 0 ? (
                      <p className="text-sm text-pac-navy/50 italic">No feedback yet.</p>
                    ) : (
                      chapter.comments.map((comment) => (
                        <div key={comment.id} className="bg-pac-cream/50 rounded-md p-3 text-sm">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold text-pac-navy">{comment.author.full_name}</span>
                            <span className="text-xs text-pac-navy/50">{new Date(comment.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-pac-navy/80">{comment.body}</p>
                        </div>
                      ))
                    )}

                    {(user.role === "supervisor" || user.role === "admin") && (
                      <CommentForm chapterId={chapter.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-32 bg-pac-navy/10 rounded"></div>
      <div className="h-48 bg-white border border-pac-navy/10 rounded-lg shadow-sm"></div>
      <div className="h-8 w-32 bg-pac-navy/20 rounded mt-8"></div>
      <div className="h-64 bg-white border border-pac-navy/10 rounded-lg shadow-sm"></div>
    </div>
  );
}