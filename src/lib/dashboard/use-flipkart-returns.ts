import { useQuery } from "@tanstack/react-query";
import { fetchFlipkartReturns } from "@/lib/dashboard/flipkart";
import type { DashboardFilters } from "@/lib/dashboard/types";

export function useFlipkartReturns(brand: DashboardFilters["brand"], start: string, end: string) {
  return useQuery({
    queryKey: ["flipkart-returns", brand, start, end],
    queryFn: async () => {
      const dates = {
        fromDate: `${start}T00:00:00+05:30`,
        toDate: `${end}T23:59:59+05:30`,
      };
      const fetchForSeller = (seller: "claspo" | "monkeyman") =>
        fetchFlipkartReturns({ data: { ...dates, seller } });

      if (brand === "CLASPO") return fetchForSeller("claspo");
      if (brand === "MONKEYMAN") return fetchForSeller("monkeyman");

      const [claspo, monkeyman] = await Promise.all([
        fetchForSeller("claspo"),
        fetchForSeller("monkeyman"),
      ]);
      return {
        configured: claspo.configured || monkeyman.configured,
        customerReturns: [...claspo.customerReturns, ...monkeyman.customerReturns],
        courierReturns: [...claspo.courierReturns, ...monkeyman.courierReturns],
        customerError: [
          claspo.customerError && `Claspo: ${claspo.customerError}`,
          monkeyman.customerError && `Monkeyman: ${monkeyman.customerError}`,
        ].filter(Boolean).join(" · ") || undefined,
        courierError: [
          claspo.courierError && `Claspo: ${claspo.courierError}`,
          monkeyman.courierError && `Monkeyman: ${monkeyman.courierError}`,
        ].filter(Boolean).join(" · ") || undefined,
      };
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
