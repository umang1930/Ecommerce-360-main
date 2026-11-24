
export type InvoicePriority =
  "vendor-priority" | "overdue" | "due-soon" | "high-amount" | "needs-review" | "upcoming" | "paid";

export interface InvoiceExtraction {
  dueDate: string | null;
  invoiceDate?: string | null;
  vendorName?: string | null;
  vendorGstin?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  bankAccountNumber?: string | null;
  ifsc?: string | null;
  amount?: number | null;
  paid: boolean;
  extraction: "complete" | "needs-review";
  reason?: string;
  recognizedText?: string;
  rawRecognizedText?: string;
  corrections?: string[];
  readMethod?: "embedded-pdf-text" | "browser-ocr" | "server-ocr";
  confidence?: number;
}

export interface InvoiceReadResult {
  text: string;
  method: "embedded-pdf-text" | "browser-ocr" | "server-ocr";
  confidence?: number;
}

export function extractInvoiceMetadata(
  text: string,
  read?: Pick<InvoiceReadResult, "method" | "confidence">,
): InvoiceExtraction {
  const { text: correctedText, corrections } = correctGstinOcr(text);
  const { dueDate, reason } = extractDueDate(correctedText);
  const invoiceDate = extractInvoiceDate(correctedText);
  const vendorName = findVendorName(correctedText);
  const vendorGstin = extractVendorGstin(correctedText);
  const bankName =
    extractLabeledValue(correctedText, /bank\s+name/i)?.replace(
      /\s+(?:COURIERS?\s+CHARGES|CGST|SGST|IGST|GRAND\s+TOTAL|TOTAL|BRANCH\b).*$/i,
      "",
    ) ?? null;
  const accountHolder =
    extractMultiLineLabeledValue(correctedText, /account\s+holder(?:'s)?\s+name/i) ??
    extractMultiLineLabeledValue(correctedText, /company\s+name/i);
  const accountLine = extractLabeledValue(correctedText, /(?:bank\s+)?account\s+(?:no\.?|number)/i);
  const bankAccountNumber = accountLine?.match(/\d{9,18}/)?.[0] ?? null;
  const ifscLine = extractLabeledValue(correctedText, /(?:bank\s+)?IFSC(?:\s+code)?/i);
  const ifsc = ifscLine?.toUpperCase().match(/[A-Z]{4}0[A-Z0-9]{6}/)?.[0] ?? null;
  const amount = extractInvoiceAmount(correctedText);
  const paid =
    /(?:^|\n)\s*(?:PAID(?:\s+IN\s+FULL)?|PAYMENT\s+RECEIVED|SETTLED\s+IN\s+FULL)\s*(?:\n|$)/im.test(
      correctedText,
    );
  const lowConfidence =
    (read?.method === "browser-ocr" || read?.method === "server-ocr") &&
    read.confidence !== undefined && read.confidence < 55;
  const extracted: InvoiceExtraction = {
    dueDate,
    invoiceDate,
    vendorName,
    vendorGstin,
    bankName,
    accountHolder,
    bankAccountNumber,
    ifsc,
    amount,
    paid,
    extraction: (dueDate && !lowConfidence) || paid ? "complete" : "needs-review",
    recognizedText: correctedText.trim(),
    rawRecognizedText: text.trim(),
    ...(corrections.length ? { corrections } : {}),
    ...(read?.method ? { readMethod: read.method } : {}),
    ...(read?.confidence !== undefined ? { confidence: read.confidence } : {}),
  };
  if (paid) extracted.reason = "OCR found an explicit paid marker on the invoice.";
  else if (lowConfidence)
    extracted.reason = `OCR confidence is ${read.confidence}%, so the detected date may be unreliable. Check the OCR text before using its priority.`;
  else if (reason) extracted.reason = reason;
  return extracted;
}

function correctGstinOcr(text: string) {
  const corrections: string[] = [];
  const corrected = text.replace(
    /(\bGSTIN\b\s*[:#-]?\s*)([0-9A-Z]{14})([)\]}])(?=\s|$)/gi,
    (whole, label: string, first14: string, mistakenGlyph: string) => {
      const normalized = first14.toUpperCase();
      if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z$/.test(normalized)) return whole;
      const checkCharacter = calculateGstinCheckCharacter(normalized);
      corrections.push(
        `GSTIN final character: OCR read “${mistakenGlyph}”; checksum indicates “${checkCharacter}”.`,
      );
      return `${label}${normalized}${checkCharacter}`;
    },
  );
  return { text: corrected, corrections };
}

function calculateGstinCheckCharacter(first14: string) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let index = 0; index < first14.length; index += 1) {
    const value = alphabet.indexOf(first14[index]?.toUpperCase() ?? "");
    const product = value * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return alphabet[(36 - (sum % 36)) % 36] ?? "";
}

export function getInvoicePriority(
  invoice:
    | {
        dueDate?: string | null;
        invoiceDate?: string | null;
        vendorName?: string | null;
        amount?: number | null;
        paid?: boolean;
        extraction?: string;
      }
    | undefined,
  amountThreshold = 10_000,
  today = new Date(),
): InvoicePriority {
  if (!invoice) return "needs-review";
  if (invoice.paid) return "paid";
  if (
    invoice.vendorName
      ?.toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim() === "U K PACKAGING INDUSTRIES"
  )
    return "vendor-priority";
  if (invoice.dueDate && invoice.extraction === "complete") {
    const due = new Date(`${invoice.dueDate}T00:00:00`);
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntilDue = Math.floor((due.getTime() - current.getTime()) / 86_400_000);
    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 7) return "due-soon";
  }
  if (invoice.amount !== null && invoice.amount !== undefined && invoice.amount > amountThreshold)
    return "high-amount";
  if (!invoice.dueDate || invoice.extraction !== "complete") return "needs-review";
  return "upcoming";
}

export function priorityOrder(priority: InvoicePriority) {
  return {
    "vendor-priority": 0,
    overdue: 1,
    "due-soon": 2,
    "high-amount": 3,
    upcoming: 4,
    "needs-review": 5,
    paid: 6,
  }[priority];
}

function findVendorName(text: string) {
  const header = text.split(/\b(?:bill\s+to|buyer\s+details|invoice\s+details)\b/i)[0] ?? text;
  const ignored =
    /^(?:tax\s+invoice|invoice|proforma\s+invoice|credit\s+note|debit\s+note|original|duplicate|triplicate|gstin(?:\s+.*)?|phone(?:\s+no\.?)?\s*[:#-]?.*|state\s*[:#-]?.*|address\s*[:#-]?.*)$/i;
  const candidate = header
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9&(). -]+$/g, ""),
    )
    .find(
      (line) =>
        line.length >= 2 && line.length <= 80 && /[A-Za-z]/.test(line) && !ignored.test(line),
    );
  return candidate || null;
}

function extractVendorGstin(text: string) {
  const vendorHeader =
    text.split(
      /\b(?:details\s+of\s+receiver|receiver\s+details|bill\s+to|buyer\s+details)\b/i,
    )[0] ?? text;
  const labeled = vendorHeader.match(
    /\b(?:GSTIN|GST\s*(?:NO\.?|NUMBER))\s*[:#-]*\s*([0-9A-Z][0-9A-Z \t-]{12,20})/i,
  )?.[1];
  const value = labeled
    ?.replace(/[\s-]/g, "")
    .toUpperCase()
    .match(/\d{2}[A-Z0-9]{13}/)?.[0];
  return value && /^\d{2}[A-Z0-9]{13}$/.test(value) ? value : null;
}

function extractLabeledValue(text: string, label: RegExp) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = label.exec(line);
    if (!match || match.index === undefined) continue;
    const sameLine = line
      .slice(match.index + match[0].length)
      .replace(/^[\s:;#=\-–—]+/, "")
      .trim();
    if (sameLine) return sameLine;
    const nextLine = lines[index + 1]?.trim();
    if (
      nextLine &&
      !/^(?:bank\s+name|account\s+holder|account\s+(?:no\.?|number)|ifsc)/i.test(nextLine)
    )
      return nextLine;
  }
  return null;
}

function extractMultiLineLabeledValue(text: string, label: RegExp) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = label.exec(line);
    if (!match || match.index === undefined) continue;
    const value = line
      .slice(match.index + match[0].length)
      .replace(/^[\s:;#=\-–—]+/, "")
      .replace(/\s+(?:CGST|SGST|IGST|GST\s*@|TOTAL|BRANCH\b).*$/i, "")
      .trim();
    if (!value) return extractLabeledValue(text, label);

    const continuation = lines[index + 1]?.trim();
    const isUppercaseNameContinuation =
      continuation &&
      /^[A-Z][A-Z &().'-]{1,49}$/.test(continuation) &&
      !/^(?:BANK DETAILS|AUTHORIZED SIGNATORY|BRANCH|GSTIN|IFSC|TOTAL|CGST|SGST|IGST)\b/.test(
        continuation,
      );
    return isUppercaseNameContinuation ? `${value} ${continuation}` : value;
  }
  return extractLabeledValue(text, label);
}

function extractInvoiceDate(text: string) {
  const months =
    "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
  const dateToken = `(?:\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|(?:${months})\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+(?:${months})\\s+\\d{4})`;
  const match = text.match(
    new RegExp(`(?:invoice\\s+date|bill\\s+date|date|dated)\\s*[:#-]?\\s*(${dateToken})`, "i"),
  );
  return match?.[1] ? normalizeDate(match[1]) : null;
}

function extractInvoiceAmount(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const amountPattern = /(?:₹|INR|Rs\.?\s*)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i;
  const readAmountAfter = (index: number, label: RegExp) => {
    const line = lines[index] ?? "";
    const match = label.exec(line);
    if (!match || match.index === undefined) return null;
    const sameLine = line.slice(match.index + match[0].length).match(amountPattern)?.[1];
    const nextLine = lines[index + 1]?.match(amountPattern)?.[1];
    const value = sameLine ?? nextLine;
    if (!value) return null;
    const amount = Number(value.replace(/,/g, ""));
    return Number.isFinite(amount) ? amount : null;
  };

  // Prefer explicit tax-inclusive totals. OCR may put the label and number on
  // separate lines or slightly misread the word, so inspect all total-like rows
  // and choose the largest numeric total (excluding the subtotal).
  const explicitTotalLabels = [
    /grand\s*total/i,
    /invoice\s*total/i,
    /total\s*payable/i,
    /net\s*payable/i,
  ];
  for (const label of explicitTotalLabels) {
    const candidates: number[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (!label.test(lines[index] ?? "")) continue;
      const amount = readAmountAfter(index, label);
      if (amount !== null) candidates.push(amount);
    }
    if (candidates.length) return Math.max(...candidates);
  }

  const totalCandidates: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!/\btotal\b/i.test(line) || /\bsub\s*total\b|\btotal\s+in\s+words\b/i.test(line)) continue;
    const amount = readAmountAfter(index, /\btotal\b/i);
    if (amount !== null) totalCandidates.push(amount);
  }
  if (totalCandidates.length) return Math.max(...totalCandidates);

  // If OCR loses the Total label but keeps the standard tax rows, reconstruct
  // the invoice total from subtotal plus CGST/SGST or IGST amounts.
  const amountOnLabeledRow = (label: RegExp) => {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const amount = readAmountAfter(index, label);
      if (amount !== null) return amount;
    }
    return null;
  };
  const subtotal = amountOnLabeledRow(/\bsub\s*total\b/i);
  const cgst = amountOnLabeledRow(/\bCGST\b/i);
  const sgst = amountOnLabeledRow(/\bSGST\b/i);
  const igst = amountOnLabeledRow(/\bIGST\b/i);
  if (subtotal !== null && cgst !== null && sgst !== null) return subtotal + cgst + sgst;
  if (subtotal !== null && igst !== null) return subtotal + igst;

  // Fall back to amount due/balance due only when no invoice total was found.
  for (const label of [/\bbalance\s+due\b/i, /\bamount\s+due\b/i]) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const amount = readAmountAfter(index, label);
      if (amount !== null) return amount;
    }
  }
  return null;
}

function extractDueDate(text: string): { dueDate: string | null; reason?: string } {
  if (!text.trim()) {
    return {
      dueDate: null,
      reason:
        "OCR did not recognize readable text. The file may be blurry, low contrast, or image-only in an unsupported format.",
    };
  }
  const months =
    "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
  const dateToken = `(?:\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|(?:${months})\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+(?:${months})\\s+\\d{4})`;
  const dueLabels = new RegExp(
    `(?:due\\s+date|payment\\s+due|due\\s+on|pay(?:ment)?\\s+by)\\s*[:#-]?\\s*(${dateToken})`,
    "i",
  );
  const dueMatch = text.match(dueLabels);
  if (dueMatch?.[1]) {
    const dueDate = normalizeDate(dueMatch[1]);
    return dueDate
      ? { dueDate }
      : {
          dueDate: null,
          reason: `OCR found a due-date field, but could not interpret the value: ${dueMatch[1]}.`,
        };
  }

  const invoiceDateMatch = text.match(
    new RegExp(`(?:invoice\\s+date|bill\\s+date|dated)\\s*[:#-]?\\s*(${dateToken})`, "i"),
  );
  const termsMatch = text.match(/\bnet\s+(\d{1,3})\b/i);
  if (invoiceDateMatch?.[1] && /\bdue\s+on\s+receipt\b/i.test(text)) {
    const invoiceDate = normalizeDate(invoiceDateMatch[1]);
    if (invoiceDate) return { dueDate: invoiceDate };
  }
  if (invoiceDateMatch?.[1] && termsMatch?.[1]) {
    const invoiceDate = normalizeDate(invoiceDateMatch[1]);
    if (invoiceDate) {
      const due = new Date(`${invoiceDate}T00:00:00`);
      due.setDate(due.getDate() + Number(termsMatch[1]));
      return {
        dueDate: `${due.getFullYear().toString().padStart(4, "0")}-${(due.getMonth() + 1).toString().padStart(2, "0")}-${due.getDate().toString().padStart(2, "0")}`,
      };
    }
  }
  if (invoiceDateMatch?.[1] && !termsMatch) {
    return {
      dueDate: null,
      reason: `OCR read the invoice date as “${invoiceDateMatch[1]}”, but found no explicit due date or Net N payment term to calculate one.`,
    };
  }
  return {
    dueDate: null,
    reason:
      "OCR text did not contain a readable date beside a Due Date, Payment Due, Due On, or Pay By label, or an invoice date with Net N terms.",
  };
}

function normalizeDate(value: string): string | null {
  const cleaned = value.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  let year: number;
  let month: number;
  let day: number;
  const ymd = cleaned.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  const numeric = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
  } else {
    const monthFirst = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
    const dayFirst = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (monthFirst) {
      month = monthNames.findIndex((name) => name === monthFirst[1]?.slice(0, 3).toLowerCase()) + 1;
      day = Number(monthFirst[2]);
      year = Number(monthFirst[3]);
    } else if (dayFirst) {
      day = Number(dayFirst[1]);
      month = monthNames.findIndex((name) => name === dayFirst[2]?.slice(0, 3).toLowerCase()) + 1;
      year = Number(dayFirst[3]);
    } else return null;
  }
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
