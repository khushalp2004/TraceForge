import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingButtonContentProps = {
  loading: boolean;
  loadingLabel: string;
  idleLabel: string;
  icon?: LucideIcon;
  iconClassName?: string;
  spinnerClassName?: string;
  textClassName?: string;
};

export function LoadingButtonContent({
  loading,
  loadingLabel,
  idleLabel,
  icon: Icon,
  iconClassName,
  spinnerClassName,
  textClassName
}: LoadingButtonContentProps) {
  return (
    <span className="inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap">
      {loading ? (
        <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin", spinnerClassName)} aria-hidden="true" />
      ) : Icon ? (
        <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} aria-hidden="true" />
      ) : null}
      <span className={cn("whitespace-nowrap", textClassName)}>{loading ? loadingLabel : idleLabel}</span>
    </span>
  );
}
