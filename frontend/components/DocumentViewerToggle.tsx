"use client";

import { useState } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";

export default function DocumentViewerToggle({ 
  fileUrl, 
  fileName, 
  versionNumber 
}: { 
  fileUrl: string; 
  fileName: string; 
  versionNumber: number; 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const documents = [
    {
      uri: fileUrl,
      fileName: fileName,
      fileType: fileName.split('.').pop()?.toLowerCase() || 'pdf',
    },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-pac-navy hover:text-pac-gold underline decoration-pac-gold/30 transition-colors"
      >
        View Document
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6">
          {/* Modal Container */}
          <div className="bg-white rounded-lg shadow-2xl w-full h-full flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-pac-navy/10 bg-pac-cream">
              <div>
                <h3 className="font-bold text-pac-navy text-lg">
                  Document Viewer
                </h3>
                <p className="text-xs text-pac-navy/60">
                  Version {versionNumber} • {fileName}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-pac-navy/60 hover:text-red-600 transition-colors text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* The Viewer */}
            <div className="flex-1 bg-gray-100 overflow-hidden">
              <DocViewer
                key={`${fileUrl}-${isOpen}`}
                documents={documents}
                pluginRenderers={DocViewerRenderers}
                style={{ height: "100%"}}
                config={{
                  header: {
                    disableHeader: true,
                    disableFileName: true,
                    retainURLParams: false,
                  },
                  pdfVerticalScrollByDefault: true,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}