export const LAYOUT_STORAGE_KEY = "traceforge_layout";

export type AppLayout = "classic";

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
  }
];

export const isAppLayout = (value: unknown): value is AppLayout => {
  return value === "classic";
};

