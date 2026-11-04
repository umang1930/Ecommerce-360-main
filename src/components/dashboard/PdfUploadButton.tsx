import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "./BrandLoader";

export function PdfUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const uploadUrl = import.meta.env.VITE_PRINTER_AUTOMATION_URL?.trim().replace(/\/+$/, "");
    if (!uploadUrl) {
      setMessage("Printer app is not configured. Set VITE_PRINTER_AUTOMATION_URL to its reachable base URL.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

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

      const outcomes: string[] = [];
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("deviceId", getUploadDeviceId());

        let response: Response;
        try {
          response = await fetch(`${uploadUrl}/api/pdf/upload`, { method: "POST", body: formData });
        } catch {
          throw new Error(
            "Could not reach the printer app. Check that it is running on the office PC and the Cloudflare tunnel is open. If both are running, the printer app may need to allow this dashboard address (CORS).",
          );
        }
        const result = await response.json().catch(() => null) as {
          message?: string;
          data?: { jobId?: string };
        } | null;

        if (!response.ok) {
          if (response.status === 502 || response.status === 504) {
            throw new Error(
              "The printer app could not be reached through the tunnel. Check that the app is running at localhost:3000 on the office PC and the Cloudflare tunnel is still open.",
            );
          }
          throw new Error(result?.message || `Printer app rejected ${file.name} (HTTP ${response.status}).`);
        }
        outcomes.push(`${file.name} sent to printer${result?.data?.jobId ? ` (job ${result.data.jobId})` : ""}.`);
      }

      if (invalidNames.length) outcomes.push(`Not valid PDFs: ${invalidNames.join(", ")}.`);
      setMessage(outcomes.join(" ") || "No valid PDF files selected.");
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

function getUploadDeviceId() {
  const key = "ecommerce360-printer-device-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}
