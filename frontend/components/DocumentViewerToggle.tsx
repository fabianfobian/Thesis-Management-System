"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { fileKind, pptxSlides, xlsxSheets, extractPlainText } from "@/lib/extract";
import { thesesApi, Chapter } from "@/lib/api";

type View =
  | { t: "pdf"; url: string }
  | { t: "text"; text: string }
  | { t: "html"; html: string }
  | { t: "sheets"; sheets: { name: string; rows: unknown[][] }[] }
  | { t: "slides"; slides: string[] };

export default function DocumentViewerToggle({
  fileUrl,
  fileName,
  versionNumber,
  chapter,
  onRefresh,
}: {
  fileUrl: string;
  fileName: string;
  versionNumber: number;
  chapter: Chapter;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"report" | "document">("document");
  const [view, setView] = useState<View | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState(0);
  const [checking, setChecking] = useState(false);
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {

    if (loadedUrlRef.current === fileUrl) return; // Prevent infinite loop
    loadedUrlRef.current = fileUrl;

    let url: string | null = null;
    setView(null);
    setErr(null);
    
    (async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("Could not download file from storage");
        const buf = await res.arrayBuffer();
        const kind = fileKind(fileName);

        if (kind === "pdf") {
          url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
          setView({ t: "pdf", url });
        } else if (kind === "txt") {
          setView({ t: "text", text: new TextDecoder().decode(buf) });
        } else if (kind === "docx") {
          const mammoth = await import("mammoth");
          setView({ t: "html", html: (await mammoth.convertToHtml({ arrayBuffer: buf })).value });
        } else if (kind === "xlsx") {
          setView({ t: "sheets", sheets: await xlsxSheets(buf) });
        } else if (kind === "pptx") {
          setView({ t: "slides", slides: await pptxSlides(buf) });
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load file");
      }
    })();

    return () => { if (url) URL.revokeObjectURL(url); };
  }, [fileUrl, fileName]);

  useEffect(() => {
    if (!extractedText && !err && loadedUrlRef.current === fileUrl) {
      extractPlainText(fileUrl, fileName).then(setExtractedText).catch((e) => setErr(e.message));
    }
  }, [fileUrl, fileName, extractedText, err,chapter.id]);

  async function handleRunCheck() {
    if (!extractedText) return;
    setChecking(true);
    try {
      await thesesApi.checkPlagiarism(chapter.id, extractedText);
      onRefresh(); 
    } catch (e) {
      alert("Failed to run check");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-pac-navy/10 shadow-sm w-full overflow-hidden flex flex-col">
      
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-pac-navy/10 bg-pac-cream">
        <div>
          <h3 className="font-bold text-pac-navy text-sm">Version {versionNumber} • {fileName}</h3>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-md border border-pac-navy/20 p-1">
          <button
            onClick={() => setActiveTab("report")}
            className={`px-3 py-1 text-xs font-medium rounded ${activeTab === "report" ? "bg-pac-navy text-white" : "text-pac-navy/60 hover:text-pac-navy"}`}
          >
            Originality Report
          </button>
          <button
            onClick={() => setActiveTab("document")}
            className={`px-3 py-1 text-xs font-medium rounded ${activeTab === "document" ? "bg-pac-navy text-white" : "text-pac-navy/60 hover:text-pac-navy"}`}
          >
            Original Document
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="h-[70vh] overflow-hidden relative">
        {err ? (
          <p className="p-6 text-sm text-red-600">{err}</p>
        ) : activeTab === "report" ? (
          <div className="h-full overflow-auto bg-gray-50 flex flex-col md:flex-row">
            
            {/* Left Side: Extracted Text */}
            <div className="flex-1 bg-white overflow-auto p-8 border-r border-pac-navy/10">
              <h4 className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-4">Extracted Text</h4>
              {!extractedText ? (
                <div className="flex items-center gap-2 text-sm text-pac-navy/60">
                  <Loader2 className="h-4 w-4 animate-spin" /> Extracting text...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans leading-relaxed text-sm text-black">
                  {extractedText}
                </pre>
              )}
            </div>
            
            {/* Right Side: Plagiarism Sidebar */}
            <div className="w-full md:w-80 bg-pac-cream/30 p-6 flex flex-col gap-4 overflow-auto border-t md:border-t-0 md:border-l border-pac-navy/10">
              <div>
                <h4 className="font-bold text-pac-navy mb-2">Similarity Score</h4>
                
                {/* If the check is pending (e.g. just uploaded) */}
                {chapter.plagiarism_status === "pending" || chapter.plagiarism_status === "checking" ? (
                  <div className="p-4 rounded-lg bg-white border border-pac-navy/10 text-center flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-pac-navy" />
                    <p className="text-sm text-pac-navy/60">Checking document...</p>
                  </div>
                ) : chapter.plagiarism_status === "checked" ? (
                  /* If the check is done, show the score */
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    (chapter.plagiarism_score ?? 0) > 20 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {(chapter.plagiarism_score ?? 0) > 20 ? <AlertTriangle /> : <CheckCircle />}
                    <div>
                      <p className="text-3xl font-bold">{chapter.plagiarism_score}%</p>
                      <p className="text-xs">{(chapter.plagiarism_score ?? 0) > 20 ? "High similarity" : "Acceptable similarity"}</p>
                    </div>
                  </div>
                ) : (
                  /* If the check failed */
                  <div className="p-4 rounded-lg bg-red-50 text-red-800 text-sm">
                    Failed to generate report.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          !view ? (
            <div className="flex items-center justify-center h-full gap-2 text-sm text-pac-navy/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading document...
            </div>
          ) : view.t === "pdf" ? (
            <iframe src={`${view.url}#toolbar=0&navpanes=0`} title={fileName} className="h-full w-full border-0 bg-white" />
          ) : view.t === "text" ? (
            <div className="h-full overflow-auto bg-white">
              <pre className="whitespace-pre-wrap p-8 font-sans leading-relaxed text-sm text-black">{view.text}</pre>
            </div>
          ) : view.t === "html" ? (
            <div className="h-full overflow-auto bg-white">
              <div className="docx-view space-y-3 p-8 leading-relaxed text-sm text-black [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_table]:border [&_td]:border [&_td]:p-1 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: view.html }} />
            </div>
          ) : view.t === "sheets" ? (
            
            /* --- FULL EXCEL TABLE --- */
            <div className="h-full overflow-auto p-4 bg-white">
              <div className="mb-3 flex flex-wrap gap-2">
                {view.sheets.map((x, i) => (
                  <button 
                    key={x.name} 
                    onClick={() => setSheet(i)} 
                    className={`rounded-md border px-3 py-1 text-sm ${i === sheet ? "bg-pac-navy text-white" : "bg-white hover:bg-pac-cream"}`}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-md border bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    {view.sheets[sheet]?.rows.map((r, i) => (
                      <tr key={i} className={i === 0 ? "bg-pac-cream font-semibold" : ""}>
                        {r.map((c, j) => <td key={j} className="border px-2 py-1 align-top text-black">{c == null ? "" : String(c)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          ) : view.t === "slides" ? (
            
            /* --- FULL POWERPOINT SLIDES --- */
            <div className="h-full overflow-auto space-y-4 p-4 bg-gray-50">
              {view.slides.map((txt, i) => (
                <div key={i} className="aspect-video overflow-auto rounded-md border bg-white p-6 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase text-pac-navy/60">Slide {i + 1}</p>
                  {txt.split("\n").map((l, j) => <p key={j} className={j === 0 ? "text-xl font-bold text-black" : "text-sm text-black"}>{l}</p>)}
                </div>
              ))}
            </div>
            
          ) : null
        )}
      </div>
    </div>
  );
}