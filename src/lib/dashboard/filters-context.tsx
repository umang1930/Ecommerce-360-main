import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "./api";
import { addDays, resolveRange, todayIST } from "./dates";
import type { DashboardData, DashboardFilters } from "./types";

export const DEFAULT_FILTERS: DashboardFilters = {
  brand: "all",
  marketplace: "all",
  period: "last7",
  product: "all",
  startDate: addDays(todayIST(), -6),
  endDate: todayIST(),
};

interface DashboardContextValue {
  filters: DashboardFilters;
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  resetFilters: () => void;
  applyCustomRange: (start: string, end: string) => void;
  data: DashboardData | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => void;
  catalog: { sku: string; name: string; brand: string }[];
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const query = useQuery({
    queryKey: ["dashboard", appliedFilters],
    queryFn: () => fetchDashboardData(appliedFilters),
    staleTime: 30_000,
    // A failed Amazon request may be a rate-limit response; don't multiply it
    // into several immediate attempts through React Query's default retries.
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (appliedFilters.period !== "last30") return;

    const range = resolveRange(appliedFilters);
    const statusCounts = query.data?.flipkartOrders.reduce<Record<string, number>>((counts, order) => {
      const status = order.status || "UNKNOWN";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    console.warn(`[Dashboard API trace] Last 30 Days · ${range.start} to ${range.end}`, {
      requestState: query.isFetching ? "Fetching dashboard data" : "Request settled",
      appliedFilters,
      metrics: query.data?.metrics,
      flipkartStatusCounts: statusCounts,
      flipkartOrders: query.data?.flipkartOrders,
      flipkartDeliveredOrders: query.data?.deliveredFlipkartOrders,
      amazonOrders: query.data?.amazonOrders,
      fullDashboardResponse: query.data,
      error: query.error ?? undefined,
    });
    if (query.data) {
      console.warn("Flipkart status-count rows:", Object.entries(statusCounts ?? {}).map(([status, count]) => ({ status, count })));
    }

    if (query.error) console.error("Dashboard request failed:", query.error);
  }, [appliedFilters, query.data, query.error, query.isFetching]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      filters,
      setFilter: (key, val) => {
        const next = { ...filters, [key]: val, ...(key === "brand" ? { product: "all" } : {}) };
        setFilters(next);
        // Custom range only applies once the user hits Apply.
        if (!(key === "period" && val === "custom")) setAppliedFilters(next);
      },
      resetFilters: () => {
        setFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
      },
      applyCustomRange: (start, end) => {
        const next = { ...filters, period: "custom" as const, startDate: start, endDate: end };
        setFilters(next);
        setAppliedFilters(next);
      },
      data: query.data,
      isLoading: query.isPending || query.isFetching,
      isError: query.isError,
      errorMessage: query.error instanceof Error ? query.error.message : null,
      refetch: () => void query.refetch(),
      catalog: query.data?.catalog ?? [],
    }),
    [
      filters,
      query.data,
      query.isPending,
      query.isFetching,
      query.isError,
      query.error,
      query.refetch,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}

/** Optional dashboard context for shared headers rendered outside DashboardProvider. */
export function useOptionalDashboard() {
  return useContext(DashboardContext);
}
