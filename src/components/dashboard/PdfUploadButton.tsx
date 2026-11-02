import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveUploadedPdfs } from "@/lib/dashboard/uploaded-pdfs";
import { BrandLoader } from "./BrandLoader";

export function PdfUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    setBusy(true);
    setMessage("");
    try {
      const validFiles: File[] = [];
      const invalidNames: string[] = [];
      for (const file of files) {
        const header = await file.slice(0, 1024).text();
        if (file.name.toLowerCase().endsWith(".pdf") && header.includes("%PDF-")) validFiles.push(file);
        else invalidNames.push(file.name);
      }

      if (validFiles.length) await saveUploadedPdfs(validFiles);
      const uploaded = validFiles.length ? `${validFiles.length} PDF${validFiles.length === 1 ? "" : "s"} uploaded.` : "";
      const rejected = invalidNames.length ? `Not valid PDFs: ${invalidNames.join(", ")}.` : "";
      setMessage([uploaded, rejected].filter(Boolean).join(" "));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not upload the selected PDFs.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        aria-label="Choose PDF files to upload"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
        <FileUp className="size-4" />
        {busy ? <BrandLoader compact message="Uploading…" /> : "Upload PDF"}
      </Button>
      {message ? <p role="status" className="max-w-sm text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
