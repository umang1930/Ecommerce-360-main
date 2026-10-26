import { AlertTriangle, CheckCircle2, XOctagon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { SectionHeading } from "./StateBlocks";
import type { DashboardException } from "@/lib/dashboard/types";

const STYLES: Record<
  DashboardException["severity"],
  { icon: typeof AlertTriangle; badge: string; label: string; iconClass: string }
> = {
  critical: {
    icon: XOctagon,
    badge: "bg-destructive/10 text-destructive",
    label: "Critical",
    iconClass: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-warning/15 text-warning-foreground",
    label: "Warning",
    iconClass: "text-warning",
  },
  success: {
    icon: CheckCircle2,
    badge: "bg-success/10 text-success",
    label: "Success",
    iconClass: "text-success",
  },
};

export function AttentionRequired() {
  const { data, isLoading } = useDashboard();

  return (
    <section className="card-surface p-5">
      <SectionHeading title="Attention Required" subtitle="Data quality and pipeline checks" />

      {isLoading || !data ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : data.exceptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="size-6 text-success" />
          <p className="mt-3 text-sm font-medium text-foreground">All checks passed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No data quality issues found in the available orders.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {data.exceptions.map((item) => {
            const style = STYLES[item.severity];
            const Icon = style.icon;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${style.iconClass}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  <span
                    className={`mt-2 inline-block rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold ${style.badge}`}
                  >
                    {style.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
