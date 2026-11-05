import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "./BrandLoader";

type PrintJob = {
  fileName: string;
  jobId: string;
  statusUrl: string;
  status: string;
  stage?: string;
  errorMessage?: string;
  temporarilyUnavailable?: boolean;
};

export function PdfUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const activeJobsKey = jobs
    .filter((job) => !isTerminal(job))
    .map((job) => job.jobId)
    .join("|");

  useEffect(() => {
    if (!activeJobsKey) return;
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const poll = async () => {
      const pendingJobs = jobsRef.current.filter((job) => !isTerminal(job));
      for (const current of pendingJobs) {
        if (cancelled) return;
        try {
          const response = await fetch(current.statusUrl, {
            method: "GET",
            cache: "no-store",
            headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const result = await response.json() as {
            data?: { job?: { status?: string; stage?: string; errorMessage?: string } };
          };
          const job = result.data?.job;
          if (!job?.status) throw new Error("Missing job status");
          setJobs((existing) => existing.map((item) => item.jobId === current.jobId ? {
            ...item,
            status: job.status!.toUpperCase(),
            stage: job.stage?.toUpperCase(),
            errorMessage: job.errorMessage,
            temporarilyUnavailable: false,
          } : item));
        } catch {
          setJobs((existing) => existing.map((item) => item.jobId === current.jobId
            ? { ...item, temporarilyUnavailable: true }
            : item));
        }
      }
      if (!cancelled) {
        const timer = setTimeout(() => { timers.delete(timer); void poll(); }, 2500);
        timers.add(timer);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [activeJobsKey]);

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
    setJobs([]);
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
            "Could not resolve or connect to the printer app. The configured printer URL may be old or incorrect. Start the printer app and its Cloudflare tunnel, then update VITE_PRINTER_AUTOMATION_URL in the dashboard deployment and redeploy. If the URL opens in a browser but uploads still fail, allow the dashboard origin in the printer app's DASHBOARD_ORIGINS setting.",
          );
        }
        const result = await response.json().catch(() => null) as {
          message?: string;
          data?: { jobId?: string; statusUrl?: string };
        } | null;

        if (!response.ok) {
          if (response.status === 502 || response.status === 504) {
            throw new Error(
              "The printer app could not be reached through the tunnel. Check that the app is running at localhost:3000 on the office PC and the Cloudflare tunnel is still open.",
            );
          }
          throw new Error(result?.message || `Printer app rejected ${file.name} (HTTP ${response.status}).`);
        }
        const jobId = result?.data?.jobId;
        if (jobId) {
          setJobs((existing) => [...existing, {
            fileName: file.name,
            jobId,
            statusUrl: getStatusUrl(result?.data?.statusUrl, uploadUrl, jobId),
            status: "QUEUED",
          }]);
        } else {
          outcomes.push(`${file.name} sent to printer.`);
        }
      }

      if (invalidNames.length) outcomes.push(`Not valid PDFs: ${invalidNames.join(", ")}.`);
      setMessage(outcomes.join(" ") || (validFiles.length ? "PDF uploaded to Printer Hub." : "No valid PDF files selected."));
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
      {jobs.map((job) => {
        const failed = job.status === "FAILED" || job.stage === "PRINT_FAILED";
        const completed = job.status === "COMPLETED" || job.stage === "PRINT_COMPLETED";
        const outOfPaper = failed && /paper.{0,20}(empty|out)|(empty|out).{0,20}paper/i.test(job.errorMessage || "");
        let statusText = "Print job queued";
        if (job.temporarilyUnavailable) statusText = "Print status temporarily unavailable; retrying";
        else if (outOfPaper) statusText = "Out of Paper";
        else if (failed) statusText = "Print Failed";
        else if (completed) statusText = "Print Completed";
        else if (job.stage === "PRINT_JOB_SUBMITTED") statusText = "Sent to printer; confirming print";
        return (
          <p key={job.jobId} role="status" className="max-w-sm text-xs text-muted-foreground">
            {job.fileName}: {statusText} (job {job.jobId})
            {failed && job.errorMessage ? ` — ${job.errorMessage}` : ""}
          </p>
        );
      })}
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

function isTerminal(job: PrintJob) {
  return job.status === "COMPLETED" || job.status === "FAILED" ||
    job.stage === "PRINT_COMPLETED" || job.stage === "PRINT_FAILED";
}

function getStatusUrl(statusUrl: string | undefined, baseUrl: string, jobId: string) {
  const fallback = `${baseUrl}/api/print/jobs/${encodeURIComponent(jobId)}`;
  if (!statusUrl) return fallback;

  try {
    const resolved = new URL(statusUrl, baseUrl);
    // Printer Hub may advertise its bind address, which is not reachable from Vercel browsers.
    if (["0.0.0.0", "localhost", "127.0.0.1", "::1"].includes(resolved.hostname)) {
      return `${baseUrl}${resolved.pathname}${resolved.search}`;
    }
    return resolved.toString();
  } catch {
    return fallback;
  }
}
