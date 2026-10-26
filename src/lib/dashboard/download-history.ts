export interface DashboardDownloadRecord {
  id: string;
  filename: string;
  start: string;
  end: string;
  rangeType: "weekly" | "monthly" | "custom";
  rows: number;
  downloadedAt: string;
  brand: string;
  marketplace: string;
  product: string;
}

const STORAGE_KEY = "ecommerce360-dashboard-download-history";
const UPDATED_EVENT = "ecommerce360-download-history-updated";

export function readDownloadHistory(): DashboardDownloadRecord[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as DashboardDownloadRecord[] : [];
  } catch {
    return [];
  }
}

export function saveDownloadRecord(record: DashboardDownloadRecord) {
  const history = [record, ...readDownloadHistory()].slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function downloadHistoryUpdatedEvent() {
  return UPDATED_EVENT;
}
