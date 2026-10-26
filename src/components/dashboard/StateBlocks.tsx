import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}
    >
      <Inbox className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">No data available</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Try changing your filters or date range.
      </p>
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string | null }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="mt-3 text-base font-semibold text-foreground">Unable to load dashboard data</p>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        {message || "Something interrupted the request. Please try again."}
      </p>
      <Button className="mt-5" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
