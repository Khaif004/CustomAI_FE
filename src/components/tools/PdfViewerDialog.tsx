import { useEffect, useRef, useState } from "react";

interface PdfViewerPayload {
  url: string;
  title?: string;
}

interface Props {
  onClose: () => void;
  payload: PdfViewerPayload;
}

const PdfViewerDialog = ({ onClose, payload }: Props) => {
  const { url, title } = payload;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const handleView = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pdf-dialog-backdrop" onClick={onClose}>
      <div className="pdf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-dialog-header">
          <span className="pdf-dialog-title">{title || "Document"}</span>
          <div className="pdf-dialog-actions">
            <button className="pdf-btn pdf-btn-print" onClick={handlePrint} title="Print">
              🖨️ Print
            </button>
            <button className="pdf-btn pdf-btn-view" onClick={handleView} title="Open in new tab">
              🔗 View
            </button>
            <button className="pdf-btn pdf-btn-close" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          src={url}
          className="pdf-dialog-frame"
          title={title || "PDF Viewer"}
        />
      </div>
    </div>
  );
};

/** Mounts an invisible listener that shows PdfViewerDialog on `btp-copilot:open-pdf` events. */
export const PdfViewerHost = () => {
  const [payload, setPayload] = useState<PdfViewerPayload | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PdfViewerPayload | undefined;
      if (detail?.url) setPayload(detail);
    };
    window.addEventListener("btp-copilot:open-pdf", handler);
    return () => window.removeEventListener("btp-copilot:open-pdf", handler);
  }, []);

  if (!payload) return null;
  return <PdfViewerDialog payload={payload} onClose={() => setPayload(null)} />;
};
