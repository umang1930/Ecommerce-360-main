import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { SalesOverview } from "@/components/dashboard/SalesOverview";
import { MarketplaceCard } from "@/components/dashboard/MarketplaceCard";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { AttentionRequired } from "@/components/dashboard/AttentionRequired";
import { FlipkartOrders } from "@/components/dashboard/FlipkartOrders";
import { FlipkartUpcomingOrders } from "@/components/dashboard/FlipkartUpcomingOrders";
import { FlipkartToAcceptOrders } from "@/components/dashboard/FlipkartToAcceptOrders";
import { FlipkartReturns } from "@/components/dashboard/FlipkartReturns";
import { AmazonReturns } from "@/components/dashboard/AmazonReturns";
import { FlipkartInventory } from "@/components/dashboard/FlipkartInventory";
import { AmazonOrders } from "@/components/dashboard/AmazonOrders";
import { ErrorState } from "@/components/dashboard/StateBlocks";
import { DashboardProvider, useDashboard } from "@/lib/dashboard/filters-context";
import { cn } from "@/lib/utils";

type DashboardTab = "orders" | "inventory" | "returns" | "upcoming" | "to-accept";
const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "inventory", label: "Inventory" },
  { id: "returns", label: "Returns" },
  { id: "upcoming", label: "Upcoming Orders" },
  { id: "to-accept", label: "To Accept" },
];

const title = "Founder Dashboard | Ecommerce 360 Command Center";
const description =
  "Track live Amazon and Flipkart orders, gross sales, units, AOV and top products in one founder dashboard.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
} as Parameters<ReturnType<typeof createFileRoute>>[0]);

function DashboardBody() {
  const { isError, errorMessage, refetch, filters } = useDashboard();
  const [activeTab, setActiveTab] = useState<DashboardTab>("orders");
  const visibleTabs =
    filters.marketplace === "Flipkart"
      ? DASHBOARD_TABS
      : DASHBOARD_TABS.filter((tab) => tab.id !== "upcoming" && tab.id !== "to-accept");

  useEffect(() => {
    if (
      filters.marketplace !== "Flipkart" &&
      (activeTab === "upcoming" || activeTab === "to-accept")
    )
      setActiveTab("orders");
  }, [activeTab, filters.marketplace]);

  return (
    <>
      <GlobalFilters />
      <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {isError ? (
          <ErrorState onRetry={refetch} message={errorMessage} />
        ) : (
          <>
            <KpiGrid />
            <div
              className="inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/60 p-1 align-middle"
              role="tablist"
              aria-label="Dashboard sections"
            >
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`dashboard-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls="dashboard-tab-panel"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "min-h-9 min-w-28 flex-none whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div
              id="dashboard-tab-panel"
              role="tabpanel"
              aria-labelledby={`dashboard-tab-${activeTab}`}
              className="space-y-5"
            >
              {activeTab === "orders" ? (
                <>
                  <SalesOverview />
                  <AmazonOrders />
                  <FlipkartOrders />
                  <AttentionRequired />
                </>
              ) : activeTab === "inventory" ? (
                <>
                  <FlipkartInventory />
                  <div className="grid gap-5 xl:grid-cols-3">
                    <MarketplaceCard />
                    <TopProducts />
                  </div>
                </>
              ) : activeTab === "upcoming" ? (
                <FlipkartUpcomingOrders />
              ) : activeTab === "to-accept" ? (
                <FlipkartToAcceptOrders />
              ) : (
                <>
                  <AmazonReturns />
                  <FlipkartReturns />
                </>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <DashboardBody />
        </div>
      </div>
    </DashboardProvider>
  );
}
