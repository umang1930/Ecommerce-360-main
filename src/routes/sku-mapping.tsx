import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SkuMapping } from "@/components/dashboard/SkuMapping";
import { useAuth } from "@/hooks/useAuth";
import { DashboardProvider } from "@/lib/dashboard/filters-context";
import { useDashboard } from "@/lib/dashboard/filters-context";

export const Route = createFileRoute("/sku-mapping")({
  component: SkuMappingPage,
});

function SkuMappingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader title="SKU Mapping" subtitle="Match marketplace SKUs to your master products" />
          <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
            <SkuMappingHeading />
            <SkuMapping />
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}

function SkuMappingHeading() {
  const { data } = useDashboard();
  return <p className="text-xs text-muted-foreground">Based on loaded Amazon and Flipkart order data · {data?.rangeLabel || "Loading selected range"}</p>;
}
