import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DownloadHistory } from "@/components/dashboard/DownloadHistory";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/download-history")({
  component: DownloadHistoryPage,
});

function DownloadHistoryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Download History" subtitle="Review your dashboard Excel exports." />
        <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <DownloadHistory />
        </main>
      </div>
    </div>
  );
}
