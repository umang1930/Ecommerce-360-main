import { useEffect, useState } from "react";
import { downloadHistoryUpdatedEvent, readDownloadHistory, type DashboardDownloadRecord } from "@/lib/dashboard/download-history";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function DownloadHistory() {
  const [history, setHistory] = useState<DashboardDownloadRecord[]>([]);

  useEffect(() => {
    const refresh = () => setHistory(readDownloadHistory());
    refresh();
    window.addEventListener(downloadHistoryUpdatedEvent(), refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(downloadHistoryUpdatedEvent(), refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <section id="download-history" className="card-surface scroll-mt-24 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Download History</h2>
        <p className="mt-1 text-xs text-muted-foreground">Recent Excel exports on this device</p>
      </div>
      {history.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Your dashboard exports will appear here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Downloaded", "Range", "Filters", "Rows", "File"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((record) => (
                <tr key={record.id} className="text-foreground">
                  <td className="px-5 py-3">{dateTime(record.downloadedAt)}</td>
                  <td className="px-5 py-3">{record.start} – {record.end} <span className="text-xs capitalize text-muted-foreground">({record.rangeType})</span></td>
                  <td className="px-5 py-3">{[record.brand, record.marketplace, record.product === "all" ? "All products" : record.product].join(" · ")}</td>
                  <td className="px-5 py-3">{record.rows}</td>
                  <td className="px-5 py-3 font-mono text-xs">{record.filename}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
