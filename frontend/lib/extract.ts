// Browser-only document parsing for PDF, DOCX, TXT, XLSX and PPTX uploads.
export const ACCEPTED = ".pdf,.docx,.txt,.xlsx,.pptx";

export function fileKind(name: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ["pdf", "docx", "txt", "xlsx", "pptx"].includes(ext) ? ext : null;
}

export async function pptxSlides(buf: ArrayBuffer): Promise<string[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  const out: string[] = [];
  for (const f of files) {
    const xml = await zip.file(f)!.async("string");
    const paras = xml.split(/<\/a:p>/).map((p) =>
      [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decode(m[1] ?? "")).join(""),
    );
    out.push(paras.filter((p) => p.trim()).join("\n"));
  }
  return out;
}

function decode(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export async function xlsxSheets(buf: ArrayBuffer) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, { header: 1, blankrows: false }) as unknown[][],
  }));
}

// ---------------------------------------------------------------------------
// Add this function to the bottom of lib/extract.ts
// ---------------------------------------------------------------------------
export async function extractPlainText(fileUrl: string, fileName: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error("Failed to fetch file");
  const buf = await res.arrayBuffer();
  const kind = fileKind(fileName);

  if (kind === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    // Use the CDN worker to avoid Next.js build issues
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      pages.push(tc.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    return pages.join("\n\n");
  }
  
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  
  if (kind === "txt") return new TextDecoder().decode(buf);
  
  if (kind === "xlsx") {
    const sheets = await xlsxSheets(buf);
    return sheets.map((s) => s.rows.map((r) => r.join(" ")).join("\n")).join("\n\n");
  }
  
  if (kind === "pptx") return (await pptxSlides(buf)).join("\n\n");
  
  throw new Error("Unsupported file type");
}