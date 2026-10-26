import { cn } from "@/lib/utils";

function statusStyle(status: string) {
  const normalized = status.trim().toLowerCase().replaceAll(/[\s_-]+/g, " ");

  if (normalized.includes("cancel")) return "bg-red-600 text-white shadow-sm ring-1 ring-inset ring-red-700";
  if (normalized.includes("unshipped"))
    return "bg-amber-400 text-amber-950 shadow-sm ring-1 ring-inset ring-amber-500";
  if (normalized.includes("shipped"))
    return "bg-green-600 text-white shadow-sm ring-1 ring-inset ring-green-700";
  if (normalized.includes("ready") && normalized.includes("dispatch"))
    return "bg-amber-400 text-amber-950 shadow-sm ring-1 ring-inset ring-amber-500";
  if (normalized.includes("approv")) return "bg-green-600 text-white shadow-sm ring-1 ring-inset ring-green-700";

  return "bg-muted text-muted-foreground ring-1 ring-inset ring-border";
}

export function OrderStatusBadge({ status }: { status: string }) {
  const label = status.trim().replaceAll("_", " ").replaceAll(/\s+/g, " ") || "Unknown";

  return (
    <span
      className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", statusStyle(status))}
    >
      {label}
    </span>
  );
}
