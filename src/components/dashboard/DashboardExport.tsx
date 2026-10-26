import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canonicalFlipkartSku, inferFlipkartBrand } from "@/lib/dashboard/brands";
import { addDays, todayIST } from "@/lib/dashboard/dates";
import { fetchDashboardData } from "@/lib/dashboard/api";
import { saveDownloadRecord } from "@/lib/dashboard/download-history";
import { useDashboard } from "@/lib/dashboard/filters-context";

type ExportRange = "weekly" | "monthly" | "custom";

function rangeFor(type: ExportRange, start: string, end: string) {
  const today = todayIST();
  if (type === "weekly") {
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    const mondayOffset = (day + 6) % 7;
    return { start: addDays(today, -mondayOffset), end: today };
  }
  if (type === "monthly") return { start: `${today.slice(0, 7)}-01`, end: today };
  return start <= end ? { start, end } : { start: end, end: start };
}

function xmlText(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;
  const date = (1 << 5) | 1;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, content);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + content.length;
    centralSize += central.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  const size = localParts.reduce((total, part) => total + part.length, 0)
    + centralParts.reduce((total, part) => total + part.length, 0) + end.length;
  const archive = new Uint8Array(size);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    archive.set(part, offset);
    offset += part.length;
  }
  return archive;
}

function createWorkbook(rows: (string | number)[][]) {
  const lastColumn = columnName(Math.max(0, (rows[0]?.length ?? 1) - 1));
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof value === "number" && Number.isFinite(value)) {
        return `<c r="${ref}"${rowIndex === 0 ? ' s="1"' : ""}><v>${value}</v></c>`;
      }
      return `<c r="${ref}" s="${rowIndex === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastColumn}${Math.max(rows.length, 1)}"/></worksheet>`;
  return zipStore([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF137C78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", content: worksheet },
  ]);
}

export function DashboardExport() {
  const { filters } = useDashboard();
  const today = todayIST();
  const [rangeType, setRangeType] = useState<ExportRange>("weekly");
  const [start, setStart] = useState(addDays(today, -6));
  const [end, setEnd] = useState(today);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setIsExporting(true);
    setError("");
    try {
      const range = rangeFor(rangeType, start, end);
      const rows: (string | number)[][] = [[
        "Marketplace", "Brand", "Order date", "Order ID", "Order item ID", "Shipment ID",
        "Product", "SKU", "Status", "Quantity", "Sales", "Currency",
      ]];
      const exportFilters = { ...filters, period: "custom" as const, startDate: range.start, endDate: range.end };
      const data = await fetchDashboardData(exportFilters, { includePreviousPeriod: false });
      for (const order of data.flipkartOrders) {
        const brand = order.brand || inferFlipkartBrand(order.sku, order.title);
        const sku = canonicalFlipkartSku(order.sku, order.title) || order.sku;
        if (filters.brand !== "all" && brand !== filters.brand) continue;
        if (filters.marketplace !== "all" && filters.marketplace !== "Flipkart") continue;
        if (filters.product !== "all" && sku !== filters.product) continue;
        rows.push(["Flipkart", brand, order.orderDate, order.orderId, order.orderItemId, order.shipmentId, order.title, order.sku, order.status, order.quantity, order.customerPrice, "INR"]);
      }
      for (const order of data.amazonOrders) {
        if (filters.brand !== "all" && order.brand !== filters.brand) continue;
        if (filters.marketplace !== "all" && filters.marketplace !== "Amazon") continue;
        if (filters.product !== "all" && order.sku !== filters.product) continue;
        rows.push(["Amazon", order.brand, order.orderDate, order.orderId, order.orderItemId, "", order.title, order.sku, order.status, order.quantity, order.itemPrice, order.currency]);
      }
      const filename = `dashboard-export-${range.start}-to-${range.end}.xlsx`;
      const workbook = createWorkbook(rows);
      const blobUrl = URL.createObjectURL(new Blob([workbook.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      saveDownloadRecord({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filename,
        start: range.start,
        end: range.end,
        rangeType,
        rows: rows.length - 1,
        downloadedAt: new Date().toISOString(),
        brand: filters.brand,
        marketplace: filters.marketplace,
        product: filters.product,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export dashboard data.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-36 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Export range</span>
          <Select value={rangeType} onValueChange={(value) => setRangeType(value as ExportRange)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">This week</SelectItem>
              <SelectItem value="monthly">This month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {rangeType === "custom" ? (
          <>
            <label className="flex min-w-36 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start date</span>
              <Input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} />
            </label>
            <label className="flex min-w-36 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">End date</span>
              <Input type="date" value={end} min={start} max={today} onChange={(event) => setEnd(event.target.value)} />
            </label>
          </>
        ) : null}
        <Button onClick={() => void exportData()} disabled={isExporting || (rangeType === "custom" && (!start || !end))}>
          <Download className="size-4" />
          {isExporting ? "Preparing…" : "Export Excel"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
