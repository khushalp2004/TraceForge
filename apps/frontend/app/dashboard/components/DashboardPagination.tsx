"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PageSizeOption = {
  value: number;
  label: string;
};

type DashboardPaginationProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: PageSizeOption[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
  variant?: "full" | "compact";
};

const getVisiblePages = (page: number, totalPages: number) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, page - 1, page, page + 1, totalPages];
};

export function DashboardPagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  className = "mt-4",
  variant = "full"
}: DashboardPaginationProps) {
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 rounded-md border border-border/40 bg-card p-3 shadow-sm ${className}`}>
      <div className="flex items-center gap-2.5 text-xs text-text-secondary font-medium">
        <span>Rows per page</span>
        <select
          className="bg-transparent font-medium text-text-primary outline-none focus:ring-0 cursor-pointer appearance-none"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-1.5 rounded-lg text-text-secondary hover:bg-secondary/40 hover:text-text-primary disabled:opacity-50 disabled:pointer-events-none transition-colors"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </button>

        {variant === "full" && (
          <div className="flex items-center gap-0.5 px-2">
            {visiblePages.map((pageNumber, index) => {
              const previousPage = visiblePages[index - 1];
              const showGap = previousPage && pageNumber - previousPage > 1;

              return (
                <div key={pageNumber} className="flex items-center">
                  {showGap && <span className="px-2 text-text-secondary/50">...</span>}
                  <button
                    type="button"
                    className={`min-w-[28px] h-7 px-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                      page === pageNumber
                        ? "bg-text-primary text-background"
                        : "text-text-secondary hover:bg-secondary/40 hover:text-text-primary"
                    }`}
                    onClick={() => onPageChange(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="p-1.5 rounded-lg text-text-secondary hover:bg-secondary/40 hover:text-text-primary disabled:opacity-50 disabled:pointer-events-none transition-colors"
          onClick={() => onPageChange(Math.max(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </button>
      </div>
    </div>
  );
}
