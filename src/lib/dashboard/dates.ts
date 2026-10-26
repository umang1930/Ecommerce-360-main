import type { DashboardFilters, PeriodKey } from "./types";

export const TIME_ZONE = "Asia/Kolkata";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Asia/Kolkata as yyyy-MM-dd. */
export function todayIST(): string {
  return dayFormatter.format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}


export function diffDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export interface DateRange {
  start: string;
  end: string;
}

export function resolveRange(filters: DashboardFilters): DateRange {
  const today = todayIST();
  const period: PeriodKey = filters.period;
  switch (period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case "last7":
      return { start: addDays(today, -6), end: today };
    case "last30":
      return { start: addDays(today, -29), end: today };
    case "custom": {
      const start = filters.startDate ?? addDays(today, -6);
      const end = filters.endDate ?? today;
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }
}

/** Equal-length immediately preceding range. */
export function previousRange(range: DateRange): DateRange {
  const length = diffDays(range.start, range.end);
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
}

const labelFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

export function formatDayLabel(isoDate: string): string {
  return labelFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatRangeLabel(range: DateRange): string {
  return range.start === range.end
    ? formatDayLabel(range.start)
    : `${formatDayLabel(range.start)} – ${formatDayLabel(range.end)}`;
}
