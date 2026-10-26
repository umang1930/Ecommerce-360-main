import { ChevronLeft, ChevronRight } from "lucide-react";

export const ORDERS_PAGE_SIZE = 10;

export function OrdersPagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.ceil(totalItems / ORDERS_PAGE_SIZE);
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * ORDERS_PAGE_SIZE + 1;
  const lastItem = Math.min(page * ORDERS_PAGE_SIZE, totalItems);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <span>Showing {firstItem}–{lastItem} of {totalItems}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="size-3.5" /> Previous
        </button>
        <span>Page {page} of {pageCount}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
