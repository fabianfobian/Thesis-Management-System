"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, thesesApi, User, Thesis, ApiError } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import StatusSelect from "@/components/StatusSelect";
import UploadRevision from "@/components/UploadRevision";
import CommentForm from "@/components/CommentForm";
import DocumentViewerToggle from "@/components/DocumentViewerToggle";
import { Download } from "lucide-react";

export default function ThesisDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ThesisContent />
    </Suspense>
  );
}

function ThesisContent() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
    // State for the inline date picker
  const [approvingChapterId, setApprovingChapterId] = useState<number | null>(null);
  const [deadlineDate, setDeadlineDate] = useState<string>("");
  
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"report" | "document">("document");
  const [activeDoc, setActiveDoc] = useState<{ url: string; name: string; version: number } | null>(null);

  async function refreshThesis() {
    const updated = await thesesApi.retrieve(Number(params.id));
    setThesis(updated);
  }

  useEffect(() => {
    async function loadData() {
      try {
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
          router.push("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id, router]);

  if (loading) return <DetailSkeleton />;
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

        {thesis.status === "rejected" && thesis.rejection_reason && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-sm font-bold text-red-800 mb-1 flex items-center gap-2">
              ⚠️ Proposal Rejected
            </h3>
            <p className="text-sm text-red-700">
              {thesis.rejection_reason}
            </p>
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
                
                {/* Chapter Header */}
                <div className="p-4 sm:p-6 bg-pac-cream/50 border-b border-pac-navy/10 flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-pac-navy/50 uppercase tracking-wider">
                      Chapter {chapter.number}
                    </span>
                    <h3 className="text-lg font-semibold text-pac-navy mt-1">{chapter.title}</h3>
                    
                    {/* DEADLINE DISPLAY */}
                    {chapter.deadline && chapter.status !== "approved" && (
                      <p className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1">
                        ⏰ Deadline: {new Date(chapter.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={chapter.status} label={chapter.status_display} />
                    
                    {/* SUPERVISOR REVIEW BUTTONS */}
                    {(user.role === "supervisor" || user.role === "admin") && 
                     (chapter.status === "submitted" || chapter.status === "under_review") && (
                      <div className="flex flex-col items-end gap-2 mt-2">
                        
                        {/* If currently approving this chapter, show the date picker */}
                        {approvingChapterId === chapter.id ? (
                          <div className="bg-white p-3 rounded-lg border border-pac-gold shadow-md flex flex-col gap-2">
                            <p className="text-xs font-semibold text-pac-navy">
                              Approve Chapter {chapter.number}. When is Chapter {chapter.number + 1} due?
                            </p>
                            <input 
                              type="date" 
                              value={deadlineDate}
                              onChange={(e) => setDeadlineDate(e.target.value)}
                              className="text-sm border border-pac-navy/20 rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-pac-gold"
                              min={new Date().toISOString().split("T")[0]} // Prevent past dates
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    await thesesApi.reviewChapter(chapter.id, "approved", deadlineDate || undefined);
                                    setApprovingChapterId(null); // Hide picker
                                    setDeadlineDate(""); // Reset
                                    refreshThesis();
                                  } catch (e) {
                                    alert("Failed to approve.");
                                  }
                                }}
                                className="flex-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-emerald-700"
                              >
                                Confirm
                              </button>

                              <button
                                onClick={async () => {
                                  try {
                                    await thesesApi.reviewChapter(chapter.id, "approved", undefined);
                                    setApprovingChapterId(null);
                                    setDeadlineDate("");
                                    refreshThesis();
                                  } catch (e) {
                                    alert("Failed to approve.");
                                  }
                                }}
                                className="flex-1 bg-gray-200 text-pac-navy text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-300"
                                title="Approve without a deadline"
                              >
                                No Deadline
                              </button>
                              
                              <button
                                onClick={() => {
                                  setApprovingChapterId(null);
                                  setDeadlineDate("");
                                }}
                                className="flex-1 bg-gray-100 text-pac-navy text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* If not approving, show the standard buttons */
                          <div className="flex gap-2">
                            <button
                              onClick={() => setApprovingChapterId(chapter.id)}
                              className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm("Request revisions for this chapter?")) {
                                  await thesesApi.reviewChapter(chapter.id, "revisions");
                                  refreshThesis();
                                }
                              }}
                              className="bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-red-700"
                            >
                              Request Revisions
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chapter Body */}
                <div className="p-4 sm:p-6 space-y-4">
                  {chapter.content && (
                    <p className="text-sm text-pac-navy/80 whitespace-pre-wrap">{chapter.content}</p>
                  )}
                  
                  {/* File Versions List */}
                  <div className="mt-4 border-t border-pac-navy/10 pt-4">
                    <h4 className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-3">
                      Submitted Files
                    </h4>
                    {chapter.versions.length === 0 ? (
                      <p className="text-sm text-pac-navy/50 italic">No files uploaded yet.</p>
                    ) : (
                      <ul className="space-y-2 mb-6">
                        {chapter.versions.map((v) => {
                          const fileName = v.document_url?.split("?")[0].split("/").pop() || "document.pdf";
                          return (
                            <li key={v.id} className="flex flex-col text-sm bg-pac-cream/30 p-3 rounded mb-2">
                              
                              {/* Version Header */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium text-pac-navy">Version {v.version_number}</span>
                                  <span className="text-pac-navy/50 text-xs ml-3">{new Date(v.uploaded_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {/* Download Button */}
                                  <a 
                                    href={v.document_url!} 
                                    download
                                    className="text-pac-navy/60 hover:text-pac-navy transition-colors"
                                    title="Download File"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                  <button 
                                    onClick={() => {
                                      setActiveDoc({ url: v.document_url!, name: fileName, version: v.version_number });
                                      setActiveTab("document");
                                    }}
                                    className="text-pac-navy font-medium hover:text-pac-gold underline decoration-pac-gold/30"
                                  >
                                    View Document
                                  </button>
                                </div>
                              </div>

                              {/* Per-Version Comments */}
                              <div className="mt-4 border-t border-pac-navy/10 pt-4 space-y-3">
                                <h4 className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-2">
                                  Feedback on Version {v.version_number}
                                </h4>
                                
                                {v.comments.length === 0 ? (
                                  <p className="text-sm text-pac-navy/50 italic">No feedback on this version yet.</p>
                                ) : (
                                  v.comments.map((comment) => (
                                    <div key={comment.id} className="bg-white rounded-md p-3 text-sm border border-pac-navy/10">
                                      <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-semibold text-pac-navy">{comment.author.full_name}</span>
                                        <span className="text-xs text-pac-navy/50">{new Date(comment.created_at).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-pac-navy/80">{comment.body}</p>
                                    </div>
                                  ))
                                )}
                                
                                {(user.role === "supervisor" || user.role === "admin") && (
                                  <CommentForm 
                                    chapterId={chapter.id} 
                                    versionId={v.id} 
                                    onCommentAdded={refreshThesis}
                                  />
                                )}
                              </div>

                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* The Document Viewer */}
                  {/* The Document Viewer (Full Screen Overlay) */}
                  {activeDoc && (
                    <div className="fixed inset-0 z-50 flex flex-col bg-white">
                      {/* Top Bar */}
                      <div className="flex items-center justify-between px-6 py-4 border-b border-pac-navy/10 bg-pac-navy">
                        <div>
                          <h3 className="font-bold text-pac-navy text-lg">
                            Document Viewer
                          </h3>
                          <p className="text-xs text-pac-navy/60">
                            {activeDoc.name} • Version {activeDoc.version}
                          </p>
                        </div>
                        <button 
                          onClick={() => setActiveDoc(null)} 
                          className="bg-pac-navy text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-pac-navyLight transition-colors"
                        >
                          Close Viewer
                        </button>
                      </div>

                      {/* The Viewer */}
                      <div className="flex-1 overflow-hidden">
                        <DocumentViewerToggle
                          fileUrl={activeDoc.url}
                          fileName={activeDoc.name}
                          versionNumber={activeDoc.version}
                          chapter={thesis.chapters.find(c => c.id === chapter.id) || chapter}
                          onRefresh={refreshThesis}
                        />
                      </div>
                    </div>
                  )}

                  {/* GATEKEEPER: Upload Section */}
                  {user.role === "student" && (
                    <div className="mt-4">
                      {chapter.number === 1 || 
                       thesis.chapters.find(c => c.number === chapter.number - 1)?.status === "approved" ? (
                        <UploadRevision 
                          chapterId={chapter.id} 
                          hasVersions={chapter.versions.length > 0}
                          onUploadSuccess={() =>{
                            // 1. Close the document viewer if it's open
                            setActiveDoc(null);
                            // 2. Refresh the thesis data (updates versions, progress, etc.)
                            refreshThesis();
                          }}
                        />
                      ) : (
                        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm flex items-center gap-2">
                          🔒 You must get Chapter {chapter.number - 1} approved by your supervisor before you can upload Chapter {chapter.number}.
                        </div>
                      )}
                    </div>
                  )}
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