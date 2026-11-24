import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import pdfWorkerSource from "pdfjs-dist/legacy/build/pdf.worker.mjs?raw";
import { extractInvoiceMetadata, type InvoiceExtraction, type InvoiceReadResult } from "./invoice-ocr";

const OCR_PAGE_LIMIT = 5;
const require = createRequire(import.meta.url);
const pdfWorkerPath = join(tmpdir(), "ecommerce360-pdf.worker.mjs");
type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

async function preparePdfWorker() {
  await writeFile(pdfWorkerPath, pdfWorkerSource, "utf8");
  GlobalWorkerOptions.workerSrc = pathToFileURL(pdfWorkerPath).href;
}

function readablePdfText(text: string) {
  const trimmed = text.trim();
  const words = trimmed.match(/[A-Za-z]{2,}/g)?.length ?? 0;
  const visible = trimmed.replace(/\s/g, "").length;
  return trimmed.length >= 30 && words >= 3 && visible / trimmed.length > 0.5;
}

async function extractEmbeddedText(pdf: PDFDocumentProxy) {
  const pages: string[] = [];
  for (let number = 1; number <= Math.min(pdf.numPages, OCR_PAGE_LIMIT); number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const lines: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];
    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item) || typeof item.str !== "string" || !item.str.trim()) continue;
      const x = item.transform[4] ?? 0;
      const y = item.transform[5] ?? 0;
      let line = lines.find((candidate) => Math.abs(candidate.y - y) < 3);
      if (!line) { line = { y, parts: [] }; lines.push(line); }
      line.parts.push({ x, text: item.str });
    }
    lines.sort((left, right) => right.y - left.y);
    pages.push(lines.map((line) => line.parts.sort((left, right) => left.x - right.x).map((part) => part.text).join(" ")).join("\n"));
  }
  return pages.join("\n");
}

async function recognizeImage(worker: TesseractWorker, bytes: Uint8Array) {
  const image = await loadImage(bytes);
  const scale = Math.min(1, 2200 / Math.max(image.width, image.height, 1));
  const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = await worker.recognize(canvas.toBuffer("image/png"));
  return { text: result.data.text, method: "server-ocr" as const, confidence: Math.round(result.data.confidence) };
}

async function recognizePdf(worker: TesseractWorker, pdf: PDFDocumentProxy): Promise<InvoiceReadResult> {
  const pages: string[] = [];
  const confidences: number[] = [];
  for (let number = 1; number <= Math.min(pdf.numPages, OCR_PAGE_LIMIT); number += 1) {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1.75 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    try {
      await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
      const result = await worker.recognize(canvas.toBuffer("image/png"));
      pages.push(result.data.text);
      confidences.push(result.data.confidence);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  const confidence = confidences.length ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : 0;
  return { text: pages.join("\n"), method: "server-ocr", confidence };
}

export async function extractInvoiceOnServer(bytes: Uint8Array, mimeType: string): Promise<InvoiceExtraction> {
  const isImage = mimeType.startsWith("image/");
  if (!isImage) {
    await preparePdfWorker();
  }
  const pdf = isImage ? undefined : await getDocument({ data: bytes }).promise;
  let worker: TesseractWorker | undefined;
  try {
    if (pdf) {
      const embedded = await extractEmbeddedText(pdf);
      if (readablePdfText(embedded)) return extractInvoiceMetadata(embedded, { method: "embedded-pdf-text" });
    }
    const cachePath = join(tmpdir(), "ecommerce360-tessdata");
    await mkdir(cachePath, { recursive: true });
    const { createWorker } = require("tesseract.js") as typeof import("tesseract.js");
    worker = await createWorker("eng", undefined, {
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      workerPath: join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
      cachePath,
      gzip: true,
      logger: () => undefined,
    });
    const read = isImage
      ? await recognizeImage(worker, bytes)
      : await recognizePdf(worker, pdf!);
    return extractInvoiceMetadata(read.text, read);
  } finally {
    try {
      if (worker) await worker.terminate();
    } finally {
      if (pdf) await pdf.destroy();
    }
  }
}
