"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { fileKind, pptxSlides, xlsxSheets, extractPlainText } from "@/lib/extract";

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
  activeTab,
  onTabChange,
}: {
  fileUrl: string;
  fileName: string;
  versionNumber: number;
  activeTab: "report" | "document";
  onTabChange: (tab: "report" | "document") => void;
}) {
  const [view, setView] = useState<View | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState(0);

  // Load original document
  useEffect(() => {
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

  // Load extracted text if the "Originality Report" tab is clicked
  useEffect(() => {
    if (activeTab === "report" && !extractedText && !err) {
      extractPlainText(fileUrl, fileName).then(setExtractedText).catch((e) => setErr(e.message));
    }
  }, [activeTab, fileUrl, fileName, extractedText, err]);

  // If we are on the Report tab (which we are using for Extracted Text)
  if (activeTab === "report") {
    return (
      <div className="h-[70vh] bg-white overflow-auto">
        {err ? (
          <p className="p-6 text-sm text-red-600">{err}</p>
        ) : !extractedText ? (
          <div className="flex items-center justify-center h-full gap-2 text-sm text-pac-navy/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Extracting document text…
          </div>
        ) : (
          <pre className="whitespace-pre-wrap p-8 font-sans leading-relaxed text-sm text-black">
            {extractedText}
          </pre>
        )}
      </div>
    );
  }

  // If we are on the Document tab (Original File)
  return (
    <div className="h-[70vh] bg-gray-50">
      {err ? (
        <p className="p-6 text-sm text-red-600">{err}</p>
      ) : !view ? (
        <div className="flex items-center justify-center h-full gap-2 text-sm text-pac-navy/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading original document…
        </div>
      ) : view.t === "pdf" ? (
        <iframe
          src={`${view.url}#toolbar=0&navpanes=0`}
          title={fileName}
          className="h-full w-full border-0 bg-white"
        />
      ) : view.t === "text" ? (
        <div className="h-full overflow-auto bg-white">
          <pre className="whitespace-pre-wrap p-8 font-sans leading-relaxed text-sm text-black">{view.text}</pre>
        </div>
      ) : view.t === "html" ? (
        <div className="h-full overflow-auto bg-white">
          {/* FIXED: Added text-black so the Word document text is no longer faded */}
          <div className="docx-view space-y-3 p-8 leading-relaxed text-sm text-black [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_table]:border [&_td]:border [&_td]:p-1 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: view.html }} />
        </div>
      ) : view.t === "sheets" ? (
        <div className="h-full overflow-auto p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {view.sheets.map((x, i) => (
              <button key={x.name} onClick={() => setSheet(i)} className={`rounded-md border px-3 py-1 text-sm ${i === sheet ? "bg-pac-navy text-white" : "bg-white hover:bg-pac-cream"}`}>{x.name}</button>
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
        <div className="h-full overflow-auto space-y-4 p-4 bg-gray-50">
          {view.slides.map((txt, i) => (
            <div key={i} className="aspect-video overflow-auto rounded-md border bg-white p-6 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase text-pac-navy/60">Slide {i + 1}</p>
              {txt.split("\n").map((l, j) => <p key={j} className={j === 0 ? "text-xl font-bold text-black" : "text-sm text-black"}>{l}</p>)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}