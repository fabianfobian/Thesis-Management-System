"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Required for react-pdf to work. We point it to a CDN worker.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    console.error("PDF Load Error:", err);
    setError("Failed to load the PDF. The link may have expired. Please refresh.");
  }

  return (
    <div className="flex flex-col items-center bg-gray-100 p-4 rounded-lg border border-pac-navy/10 w-full overflow-hidden">
      {error ? (
        <p className="text-red-600 text-sm py-8">{error}</p>
      ) : (
        <>
          <div className="shadow-lg border border-gray-300 w-full flex justify-center overflow-x-auto">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="h-96 w-full flex items-center justify-center bg-white text-pac-navy">
                  Loading PDF...
                </div>
              }
            >
              <Page 
                pageNumber={pageNumber} 
                renderTextLayer={true} 
                renderAnnotationLayer={true}
                width={600}
              />
            </Document>
          </div>

          {/* Pagination Controls */}
          {numPages && (
            <div className="flex items-center gap-4 mt-4 bg-white px-4 py-2 rounded-full shadow-sm border border-pac-navy/10">
              <button
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((prev) => prev - 1)}
                className="text-sm font-semibold text-pac-navy disabled:opacity-30 hover:text-pac-gold transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-pac-navy/70">
                Page {pageNumber} of {numPages}
              </span>
              <button
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((prev) => prev + 1)}
                className="text-sm font-semibold text-pac-navy disabled:opacity-30 hover:text-pac-gold transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}