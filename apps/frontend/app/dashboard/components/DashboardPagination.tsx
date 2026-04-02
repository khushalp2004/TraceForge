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
    <div className={`${className} rounded-2xl border border-border bg-card/90 px-4 py-4 shadow-sm`}>
      <div className="tf-pagination-bar">
        <div className="tf-pagination-size">
          <select
            className="tf-select tf-pagination-select w-full"
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
        <div className="tf-pagination-controls">
          <button
            type="button"
            className="tf-pagination-button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            {variant === "compact" ? (
              <>
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="sr-only">Previous page</span>
              </>
            ) : (
              "Prev"
            )}
          </button>
          {variant === "full" &&
            visiblePages.map((pageNumber, index) => {
              const previousPage = visiblePages[index - 1];
              const showGap = previousPage && pageNumber - previousPage > 1;

              return (
                <div key={pageNumber} className="flex items-center gap-2">
                  {showGap && <span className="tf-pagination-gap">...</span>}
                  <button
                    type="button"
                    className={`tf-pagination-page ${
                      page === pageNumber
                        ? "tf-pagination-page-active"
                        : "tf-pagination-page-idle"
                    }`}
                    onClick={() => onPageChange(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                </div>
              );
            })}
          <button
            type="button"
            className="tf-pagination-button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            {variant === "compact" ? (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="sr-only">Next page</span>
              </>
            ) : (
              "Next"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
