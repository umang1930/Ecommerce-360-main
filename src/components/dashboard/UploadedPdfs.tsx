import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteUploadedPdf, listUploadedPdfs, type UploadedPdf } from "@/lib/dashboard/uploaded-pdfs";
import { BrandLoader } from "./BrandLoader";

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadedDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function UploadedPdfs() {
  const [files, setFiles] = useState<UploadedPdf[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setFiles(await listUploadedPdfs());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load uploaded PDFs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function remove(id: string) {
    try {
      await deleteUploadedPdf(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this PDF.");
    }
  }

  function openPdf(file: UploadedPdf, download: boolean) {
    const url = URL.createObjectURL(file.file);
    const link = document.createElement("a");
    link.href = url;
    if (download) link.download = file.name;
    else {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Uploaded PDF files</h2>
          <p className="mt-1 text-xs text-muted-foreground">PDF files saved in this browser · {files.length} files</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()}>Refresh</Button>
      </div>
      {error ? <p role="alert" className="px-5 py-4 text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <BrandLoader message="Loading uploaded PDFs…" />
      ) : files.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">No PDFs uploaded yet. Use Upload PDF on the dashboard to add files.</p>
      ) : (
        <ul className="divide-y divide-border">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><FileText className="size-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground" title={file.name}>{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fileSize(file.size)} · Uploaded {uploadedDate(file.uploadedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openPdf(file, false)} aria-label={`Open ${file.name}`}><ExternalLink className="size-4" /><span className="sr-only">Open</span></Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openPdf(file, true)} aria-label={`Download ${file.name}`}><Download className="size-4" /><span className="sr-only">Download</span></Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void remove(file.id)} aria-label={`Delete ${file.name}`}><Trash2 className="size-4" /><span className="sr-only">Delete</span></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
