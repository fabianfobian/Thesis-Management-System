"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// We dynamically import PdfViewer and disable SSR
const PdfViewer = dynamic(() => import("./PdfViewer"), { 
  ssr: false,
  loading: () => <div className="h-20 w-full bg-gray-100 animate-pulse rounded-lg mt-4"></div>
});

export default function DocumentViewerToggle({ fileUrl }: { fileUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm font-medium text-pac-navy hover:text-pac-gold underline decoration-pac-gold/30 transition-colors"
      >
        {isOpen ? "Close Document" : "View Document Inline"}
      </button>

      {isOpen && (
        <div className="mt-4 w-full">
          <PdfViewer fileUrl={fileUrl} />
        </div>
      )}
    </div>
  );
}