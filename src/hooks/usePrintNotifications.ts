import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { PrintJob } from "@/lib/print/types";

// Maintain a set of already-notified terminal jobs in memory to guarantee zero duplicate toasts
const notifiedJobIds = new Set<string>();

export function usePrintNotifications() {
  const { isAuthenticated, user } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const acknowledge = (jobId: string) => {
      fetch("/api/print/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch((err) => console.warn("[Print Notification] Ack failed:", err));
    };

    const handleJobNotification = (job: PrintJob) => {
      if (!job || !job.jobId) return;

      // Ensure notification is only shown to the user associated with this job
      if (job.userId !== user.email) return;

      // Only notify once for final outcomes
      if (job.status === "COMPLETED") {
        if (!notifiedJobIds.has(job.jobId) && !job.acknowledged) {
          notifiedJobIds.add(job.jobId);
          toast.success("Print Completed!", {
            description: "Your PDF has been printed successfully.",
            duration: 7000,
          });
          acknowledge(job.jobId);
        }
      } else if (job.status === "FAILED") {
        if (!notifiedJobIds.has(job.jobId) && !job.acknowledged) {
          notifiedJobIds.add(job.jobId);
          const description = job.errorInfo
            ? `Your PDF could not be printed. Please check the printer or try again later. (Error: ${job.errorInfo})`
            : "Your PDF could not be printed. Please check the printer or try again later.";

          toast.error("Print Failed!", {
            description,
            duration: 9000,
          });
          acknowledge(job.jobId);
        }
      }
    };

    let retryTimeout: NodeJS.Timeout | null = null;
    let cancelled = false;

    const connectSSE = () => {
      if (cancelled) return;

      try {
        const es = new EventSource("/api/print/stream");
        eventSourceRef.current = es;

        es.addEventListener("initial-jobs", (event) => {
          try {
            const jobs = JSON.parse(event.data) as PrintJob[];
            if (Array.isArray(jobs)) {
              jobs.forEach(handleJobNotification);
            }
          } catch (e) {
            console.error("[Print SSE] parse initial jobs error", e);
          }
        });

        es.addEventListener("job-update", (event) => {
          try {
            const job = JSON.parse(event.data) as PrintJob;
            handleJobNotification(job);
          } catch (e) {
            console.error("[Print SSE] parse job-update error", e);
          }
        });

        es.onerror = () => {
          es.close();
          eventSourceRef.current = null;
          // Reconnect with backoff
          if (!cancelled) {
            retryTimeout = setTimeout(connectSSE, 5000);
          }
        };
      } catch (err) {
        console.warn("[Print SSE] Connection failed:", err);
        if (!cancelled) {
          retryTimeout = setTimeout(connectSSE, 5000);
        }
      }
    };

    connectSSE();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, user]);
}
