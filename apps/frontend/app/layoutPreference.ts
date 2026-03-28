export const LAYOUT_STORAGE_KEY = "traceforge_layout";

export type AppLayout = "classic" | "compact" | "topbar";

export const DEFAULT_LAYOUT: AppLayout = "classic";

export const LAYOUTS: Array<{
  id: AppLayout;
  name: string;
  description: string;
}> = [
  {
    id: "classic",
    name: "Classic sidebar",
    description: "The default TraceForge layout with a persistent left navigation."
  },
  {
    id: "compact",
    name: "Compact sidebar",
    description: "A denser workspace with tighter spacing and a collapsed sidebar by default."
  },
  {
    id: "topbar",
    name: "Top navigation",
    description: "A focused layout with navigation in the top bar and more horizontal room."
  }
];

export const isAppLayout = (value: unknown): value is AppLayout => {
  return value === "classic" || value === "compact" || value === "topbar";
};

