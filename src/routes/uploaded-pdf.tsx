import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { UploadedPdfs } from "@/components/dashboard/UploadedPdfs";
import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/dashboard/BrandLoader";

export const Route = createFileRoute("/uploaded-pdf")({
  component: UploadedPdfsPage,
});

function UploadedPdfsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) return <BrandLoader fullScreen message="Checking your sign-in…" />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Uploaded PDF" subtitle="View and manage PDF files uploaded from this browser." />
        <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <UploadedPdfs />
        </main>
      </div>
    </div>
  );
}
