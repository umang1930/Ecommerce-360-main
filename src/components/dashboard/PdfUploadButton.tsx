import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLoader } from "./BrandLoader";

type PrinterNotification = {
  id: string;
  title: string;
  message: string;
  type: "SUCCESS" | "FAILURE" | "ERROR";
};

type PrinterEvent = {
  type?: string;
  data?: PrinterNotification;
};

export function PdfUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const deviceIdRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState<PrinterNotification | null>(null);
  const uploadUrl = import.meta.env["VITE_PRINTER_AUTOMATION_URL"]?.trim().replace(/\/+$/, "");
  if (typeof window !== "undefined" && !deviceIdRef.current) {
    deviceIdRef.current = getUploadDeviceId();
  }
  const deviceId = deviceIdRef.current;

  const acknowledgeNotification = useCallback(
    async (notificationId: string) => {
      if (!uploadUrl || !deviceId) return;
      try {
        await fetch(`${uploadUrl}/api/notifications/ack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId, deviceId }),
        });
      } catch {
        // The printer service keeps unacknowledged messages so it can retry after reconnecting.
      }
    },
    [deviceId, uploadUrl],
  );

  const showPrinterNotification = useCallback((event: PrinterEvent) => {
    if (event.type !== "PRINT_NOTIFICATION" || !event.data?.id || !event.data.message) return;
    setNotification(event.data);
  }, []);

  useEffect(() => {
    if (!uploadUrl || !deviceId) return;

    const events = new EventSource(
      `${uploadUrl}/api/events?deviceId=${encodeURIComponent(deviceId)}`,
    );
    events.onmessage = (messageEvent) => {
      try {
        showPrinterNotification(JSON.parse(messageEvent.data) as PrinterEvent);
      } catch {
        // Ignore malformed keepalive messages from the printer service.
      }
    };
    return () => events.close();
  }, [deviceId, showPrinterNotification, uploadUrl]);

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    if (!uploadUrl) {
      setMessage(
        "Printer app is not configured. Set VITE_PRINTER_AUTOMATION_URL to its reachable base URL.",
      );
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
        if (file.name.toLowerCase().endsWith(".pdf") && header.includes("%PDF-"))
          validFiles.push(file);
        else invalidNames.push(file.name);
      }

      const outcomes: string[] = [];
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("deviceId", deviceId || getUploadDeviceId());

        let response: Response;
        try {
          response = await fetch(`${uploadUrl}/api/pdf/upload`, { method: "POST", body: formData });
        } catch {
          throw new Error(
            "Could not reach the printer app. Check that it is running on the office PC and the Cloudflare tunnel is open. If both are running, the printer app may need to allow this dashboard address (CORS).",
          );
        }
        const result = (await response.json().catch(() => null)) as {
          message?: string;
          data?: { jobId?: string };
        } | null;

        if (!response.ok) {
          if (response.status === 502 || response.status === 504) {
            throw new Error(
              "The printer app could not be reached through the tunnel. Check that the app is running at localhost:3000 on the office PC and the Cloudflare tunnel is still open.",
            );
          }
          throw new Error(
            result?.message || `Printer app rejected ${file.name} (HTTP ${response.status}).`,
          );
        }
        outcomes.push(
          `${file.name} sent to printer${result?.data?.jobId ? ` (job ${result.data.jobId})` : ""}.`,
        );
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
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <FileUp className="size-4" />
        {busy ? <BrandLoader compact message="Uploading…" /> : "Upload PDF"}
      </Button>
      {message ? (
        <p role="status" className="max-w-sm text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
      <Dialog
        open={Boolean(notification)}
        onOpenChange={(open) => {
          if (!open && notification) {
            void acknowledgeNotification(notification.id);
            setNotification(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {notification?.type === "SUCCESS" ? (
                <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
              ) : (
                <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
              )}
              {notification?.title || "Printer update"}
            </DialogTitle>
            <DialogDescription>{notification?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (notification) void acknowledgeNotification(notification.id);
                setNotification(null);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getUploadDeviceId() {
  const key = "ecommerce360-printer-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
