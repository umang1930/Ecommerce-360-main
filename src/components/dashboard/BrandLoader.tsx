import { cn } from "@/lib/utils";

export function BrandLoader({
  message = "Loading…",
  fullScreen = false,
  compact = false,
  className,
}: {
  message?: string;
  fullScreen?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const Container = compact ? "span" : "div";
  return (
    <Container
      className={cn(
        "flex items-center justify-center text-center",
        compact ? "inline-flex gap-2" : "flex-col gap-3",
        fullScreen ? "fixed inset-0 z-[100] min-h-screen bg-background/85 px-4 backdrop-blur-sm" : compact ? "" : "min-h-36 py-6",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className={cn("relative inline-flex shrink-0 items-center justify-center", compact ? "size-6" : "size-[4.5rem]")} aria-hidden="true">
        <span className={cn("brand-loader-spinner absolute inset-0 rounded-full border-primary/15 border-t-primary animate-spin", compact ? "border-2" : "border-[3px]")} />
        <span className={cn("absolute rounded-full bg-white shadow-sm", compact ? "inset-[4px]" : "inset-[7px]")} />
        <img src="/loader-logo-one.png" alt="" className={cn("brand-loader-logo brand-loader-logo--one absolute object-contain", compact ? "size-4" : "size-8")} />
        <img src="/loader-logo-two.png" alt="" className={cn("brand-loader-logo brand-loader-logo--two absolute object-contain", compact ? "size-4" : "size-8")} />
      </span>
      {compact ? (
        <span className="text-xs font-medium text-muted-foreground">{message}</span>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      )}
    </Container>
  );
}
