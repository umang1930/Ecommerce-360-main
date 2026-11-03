import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { getDashboardSession } from "@/lib/dashboard/google-auth.server";
import { createPrintJob, updatePrintJobStatus } from "@/lib/print/storage.server";
import { transmitPdfToPrinter, verifyPrinterJobStatus } from "@/lib/print/cloud-printer.server";
import type { PrintJob } from "@/lib/print/types";

function isValidPdf(buffer: Buffer, fileName: string, mimeType: string): boolean {
  // Validate extension or mime type
  const hasPdfExtension = fileName.toLowerCase().endsWith(".pdf");
  const hasPdfMime = mimeType === "application/pdf" || mimeType === "application/x-pdf";
  if (!hasPdfExtension && !hasPdfMime) {
    return false;
  }

  // Validate PDF magic bytes: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (buffer.length < 5) {
    return false;
  }

  const header = buffer.subarray(0, 5).toString("ascii");
  return header.startsWith("%PDF-");
}

export const Route = createFileRoute("/api/print/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = getDashboardSession(request);
        if (!user) {
          return Response.json(
            { error: "Unauthorized. Please sign in to print." },
            { status: 401 },
          );
        }

        try {
          const contentType = request.headers.get("content-type") || "";
          if (!contentType.includes("multipart/form-data")) {
            return Response.json(
              { error: "Invalid Content-Type. Expected multipart/form-data." },
              { status: 400 },
            );
          }

          const formData = await request.formData();
          const file = formData.get("file");

          if (!file || !(file instanceof Blob)) {
            return Response.json(
              { error: "No file provided. Please select a PDF file to print." },
              { status: 400 },
            );
          }

          const fileName = (file as File).name || "document.pdf";
          const fileSizeBytes = file.size;
          const mimeType = file.type || "application/pdf";

          const arrayBuffer = await file.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);

          // Validation
          if (!isValidPdf(fileBuffer, fileName, mimeType)) {
            return Response.json(
              {
                error: "Invalid file format. Only valid PDF files with %PDF- header are accepted.",
              },
              { status: 400 },
            );
          }

          const jobId = randomUUID();
          const now = new Date().toISOString();

          // Step 1: Initialize Print Job with status UPLOADED
          const initialJob: PrintJob = {
            jobId,
            userId: user.email,
            fileName,
            fileReference: `upload://${jobId}/${fileName}`,
            fileSizeBytes,
            submissionTimestamp: now,
            status: "UPLOADED",
            finalResult: null,
            errorInfo: null,
            provider: "pending",
            providerJobId: null,
            acknowledged: false,
            createdAt: now,
            updatedAt: now,
          };

          await createPrintJob(initialJob);

          // Step 2: Automatically transfer PDF to printer integration
          await updatePrintJobStatus(jobId, { status: "QUEUED" });

          try {
            const transmission = await transmitPdfToPrinter(fileBuffer, fileName);

            await updatePrintJobStatus(jobId, {
              status: transmission.status,
              provider: transmission.provider,
              providerJobId: transmission.providerJobId,
              finalResult: transmission.message || null,
            });

            // If verifiable, start background poll loop to verify real hardware completion
            if (transmission.isVerifiable) {
              const pollVerification = async () => {
                const maxChecks = 15;
                const intervalMs = 2000;
                let currentJob = await createPrintJob({
                  ...initialJob,
                  ...transmission,
                  status: transmission.status,
                });

                for (let i = 0; i < maxChecks; i++) {
                  await new Promise((resolve) => setTimeout(resolve, intervalMs));
                  const check = await verifyPrinterJobStatus(currentJob);

                  if (check.status === "COMPLETED" || check.status === "FAILED") {
                    await updatePrintJobStatus(jobId, {
                      status: check.status,
                      finalResult: check.finalResult,
                      errorInfo: check.errorInfo,
                    });
                    break;
                  } else if (check.status !== currentJob.status) {
                    currentJob =
                      (await updatePrintJobStatus(jobId, { status: check.status })) || currentJob;
                  }
                }
              };

              // Run asynchronously without blocking response
              void pollVerification().catch((err) => {
                console.error(`[Print Background Verification] Job ${jobId} error:`, err);
              });
            }

            return Response.json({
              success: true,
              jobId,
              status: transmission.status,
              message: "PDF received and automatically sent to printer.",
            });
          } catch (transmitError) {
            const errorMessage =
              transmitError instanceof Error ? transmitError.message : "Print transmission failed.";
            await updatePrintJobStatus(jobId, {
              status: "FAILED",
              errorInfo: errorMessage,
              finalResult: "Printing failed during transmission.",
            });

            return Response.json(
              {
                success: false,
                jobId,
                status: "FAILED",
                error: errorMessage,
              },
              { status: 502 },
            );
          }
        } catch (error) {
          console.error("[Print Upload] Unexpected error:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to process print upload." },
            { status: 500 },
          );
        }
      },
    },
  },
});
