"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CircleAlert,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings2,
  Sparkles,
  Users,
  X
} from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { GLOBAL_STATIC_SEARCH_ITEMS, type GlobalSearchItem } from "./globalSearchIndex";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const DEFAULT_SUGGESTIONS_LIMIT = 3;
const SEARCH_SUGGESTIONS_LIMIT = 8;
const SEARCH_ISSUES_LIMIT = 5;

type SearchEntity = {
  id: string;
  title: string;
  description: string;
  href: string;
  group: "Projects" | "Issues" | "Alerts" | "Organizations";
  icon: "project" | "issue" | "alert" | "org";
  keywords: string[];
  badge?: string;
};

type SearchResult = GlobalSearchItem | SearchEntity;

type GlobalSearchContextValue = {
  openSearch: (initialQuery?: string) => void;
  closeSearch: () => void;
};

type ProjectRecord = {
  id: string;
  name: string;
  archivedAt?: string | null;
};

type OrgRecord = {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
};

type AlertRuleRecord = {
  id: string;
  name: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  environment: string | null;
  project: {
    id: string;
    name: string;
  } | null;
};

type IssueRecord = {
  id: string;
  message: string;
  count: number;
  lastSeen: string;
  stackTrace?: string;
};

const GlobalSearchContext = createContext<GlobalSearchContextValue | undefined>(undefined);

const normalize = (value: string) => value.trim().toLowerCase();

const matchesSearch = (query: string, fields: string[]) => {
  if (!query) {
    return true;
  }

  return fields.some((field) => normalize(field).includes(query));
};

const scoreResult = (query: string, item: SearchResult) => {
  if (!query) {
    return 0;
  }

  const haystack = [item.title, item.description, ...item.keywords].map(normalize);

  if (haystack.some((field) => field.startsWith(query))) {
    return 3;
  }

  if (haystack.some((field) => field.includes(query))) {
    return 2;
  }

  return 0;
};

const iconMap = {
  page: LayoutDashboard,
  doc: BookOpen,
  spark: Sparkles,
  issue: CircleAlert,
  alert: Bell,
  project: FolderKanban,
  org: Users,
  billing: CreditCard,
  settings: Settings2
} as const;

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isLoggedIn } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRuleRecord[]>([]);
  const [searchIssues, setSearchIssues] = useState<IssueRecord[]>([]);
  const [bootstrapLoaded, setBootstrapLoaded] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [searchIssuesLoading, setSearchIssuesLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 250);
  const normalizedQuery = normalize(debouncedQuery);

  const closeSearch = () => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  };

  const openSearch = (initialQuery = "") => {
    setOpen(true);
    setQuery(initialQuery);
    setSelectedIndex(0);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
        return;
      }

      if (event.key === "/" && !isTypingField) {
        event.preventDefault();
        openSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (token) {
      return;
    }

    setProjects([]);
    setOrgs([]);
    setAlerts([]);
    setSearchIssues([]);
    setBootstrapLoaded(false);
    setBootstrapLoading(false);
    setSearchIssuesLoading(false);
  }, [token]);

  useEffect(() => {
    if (!open || !token || bootstrapLoaded || bootstrapLoading) {
      return;
    }

    let cancelled = false;

    const loadBootstrapData = async () => {
      setBootstrapLoading(true);

      try {
        const [projectsRes, orgsRes, alertsRes] = await Promise.all([
          fetch(`${API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/orgs`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/alerts/rules`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const [projectsData, orgsData, alertsData] = await Promise.all([
          projectsRes.json(),
          orgsRes.json(),
          alertsRes.json()
        ]);

        if (cancelled) {
          return;
        }

        if (projectsRes.ok) {
          setProjects(projectsData.projects || []);
        }

        if (orgsRes.ok) {
          setOrgs(orgsData.orgs || []);
        }

        if (alertsRes.ok) {
          setAlerts(alertsData.rules || []);
        }

        setBootstrapLoaded(true);
      } finally {
        if (!cancelled) {
          setBootstrapLoading(false);
        }
      }
    };

    void loadBootstrapData();

    return () => {
      cancelled = true;
    };
  }, [bootstrapLoaded, bootstrapLoading, open, token]);

  useEffect(() => {
    if (!open || !token || normalizedQuery.length < 2) {
      setSearchIssues([]);
      setSearchIssuesLoading(false);
      return;
    }

    let cancelled = false;

    const loadSearchIssues = async () => {
      setSearchIssuesLoading(true);

      try {
        const params = new URLSearchParams({
          q: normalizedQuery,
          pageSize: String(SEARCH_ISSUES_LIMIT),
          sort: "lastSeen"
        });

        const res = await fetch(`${API_URL}/errors?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!cancelled && res.ok) {
          setSearchIssues(data.errors || []);
        }
      } finally {
        if (!cancelled) {
          setSearchIssuesLoading(false);
        }
      }
    };

    void loadSearchIssues();

    return () => {
      cancelled = true;
    };
  }, [normalizedQuery, open, token]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedIndex(0);
  }, [normalizedQuery, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      closeSearch();
    }
  }, [pathname]);

  const dynamicResults = useMemo<SearchEntity[]>(() => {
    if (!normalizedQuery) {
      return [];
    }

    const projectItems = projects
      .filter((project) => !project.archivedAt)
      .filter((project) => matchesSearch(normalizedQuery, [project.name, "project workspace api key"]))
      .slice(0, 5)
      .map((project) => ({
        id: `project:${project.id}`,
        title: project.name,
        description: "Project workspace",
        href: "/dashboard/projects",
        group: "Projects" as const,
        icon: "project" as const,
        keywords: [project.name, "project", "workspace", "api key"]
      }));

    const orgItems = orgs
      .filter((org) => matchesSearch(normalizedQuery, [org.name, org.role, "organization team members"]))
      .slice(0, 4)
      .map((org) => ({
        id: `org:${org.id}`,
        title: org.name,
        description: `${org.role.toLowerCase()} organization`,
        href: `/dashboard/orgs/${org.id}`,
        group: "Organizations" as const,
        icon: "org" as const,
        keywords: [org.name, org.role, "organization", "team"]
      }));

    const alertItems = alerts
      .filter((alert) =>
        matchesSearch(normalizedQuery, [
          alert.name,
          alert.project?.name || "",
          alert.severity,
          alert.environment || "",
          "alert rule notifications"
        ])
      )
      .slice(0, 5)
      .map((alert) => ({
        id: `alert:${alert.id}`,
        title: alert.name,
        description: `${alert.project?.name || "Project"} · ${alert.severity.toLowerCase()}`,
        href: "/dashboard/alerts",
        group: "Alerts" as const,
        icon: "alert" as const,
        keywords: [
          alert.name,
          alert.project?.name || "",
          alert.severity,
          alert.environment || "",
          "alert rule"
        ],
        badge: alert.severity
      }));

    const issueItems = searchIssues
      .map((issue) => ({
        id: `issue:${issue.id}`,
        title: issue.message,
        description: `${issue.count} hits · ${new Date(issue.lastSeen).toLocaleDateString()}`,
        href: `/dashboard/errors/${issue.id}`,
        group: "Issues" as const,
        icon: "issue" as const,
        keywords: [issue.message, issue.stackTrace || "", "issue", "error", "stack trace"]
      }));

    return [...issueItems, ...projectItems, ...alertItems, ...orgItems];
  }, [alerts, normalizedQuery, orgs, projects, searchIssues]);

  const staticResults = useMemo<GlobalSearchItem[]>(() => {
    const source = normalizedQuery
      ? GLOBAL_STATIC_SEARCH_ITEMS.filter((item) =>
          matchesSearch(normalizedQuery, [item.title, item.description, ...item.keywords])
        )
      : GLOBAL_STATIC_SEARCH_ITEMS;

    return source.slice(0, normalizedQuery ? SEARCH_SUGGESTIONS_LIMIT : DEFAULT_SUGGESTIONS_LIMIT);
  }, [normalizedQuery]);

  const groupedResults = useMemo(() => {
    const maxResults = normalizedQuery ? SEARCH_SUGGESTIONS_LIMIT : DEFAULT_SUGGESTIONS_LIMIT;
    const combined = normalizedQuery
      ? dynamicResults.length > 0
        ? dynamicResults
        : staticResults
      : staticResults;
    const ranked = normalizedQuery
      ? [...combined].sort((a, b) => scoreResult(normalizedQuery, b) - scoreResult(normalizedQuery, a))
      : combined;
    const limited = ranked.slice(0, maxResults);

    const groups = new Map<string, SearchResult[]>();

    limited.forEach((item) => {
      const key = item.group;
      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
  }, [dynamicResults, normalizedQuery, staticResults]);

  const flatResults = useMemo(
    () => groupedResults.flatMap((section) => section.items),
    [groupedResults]
  );

  useEffect(() => {
    flatResults.slice(0, 8).forEach((item) => {
      router.prefetch(item.href);
    });
  }, [flatResults, router]);

  const activeResult = flatResults[selectedIndex] || null;

  const handleSubmit = (result: SearchResult | null) => {
    if (!result) {
      return;
    }

    closeSearch();
    router.push(result.href);
  };

  const onPaletteKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (flatResults.length ? (prev + 1) % flatResults.length : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) =>
        flatResults.length ? (prev - 1 + flatResults.length) % flatResults.length : 0
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit(activeResult);
    }
  };

  const showDynamicResults = Boolean(normalizedQuery) && dynamicResults.length > 0;
  const placeholder = isLoggedIn
    ? "Search pages, or type to find rows and records..."
    : "Search pages and docs...";

  return (
    <GlobalSearchContext.Provider value={{ openSearch, closeSearch }}>
      {children}
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/45 px-4 py-8 backdrop-blur-sm sm:px-6 sm:py-12"
          onClick={closeSearch}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-2xl backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
              <Search className="h-5 w-5 text-text-secondary" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onPaletteKeyDown}
                placeholder={placeholder}
                className="h-11 w-full bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-secondary"
              />
              <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] font-semibold text-text-secondary sm:inline-flex">
                <span>ESC</span>
              </div>
              <button
                type="button"
                onClick={closeSearch}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 text-xs text-text-secondary sm:px-5">
              <p className="truncate">
                {isLoggedIn
                  ? showDynamicResults
                    ? "Showing matching rows and records from your workspace."
                    : normalizedQuery
                    ? "No row match found, so these are static page matches."
                    : "Start with page shortcuts. Typing switches to row and record matches."
                  : "Search pages and docs."}
              </p>
              <div className="hidden items-center gap-3 sm:flex">
                <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1">
                  ↑↓ Navigate
                </span>
                <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1">
                  Enter Open
                </span>
              </div>
            </div>

            <div className="max-h-[min(70vh,42rem)] overflow-y-auto">
              {!groupedResults.length ? (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary/40">
                    <Search className="h-5 w-5 text-text-secondary" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-text-primary">No results found</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Try searching for a page, doc, issue text, project, organization, or alert rule.
                  </p>
                </div>
              ) : (
                <div className="p-3 sm:p-4">
                  {groupedResults.map((section) => (
                    <div key={section.group} className="mb-4 last:mb-0">
                      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                        {section.group}
                      </p>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const index = flatResults.findIndex((result) => result.id === item.id);
                          const active = index === selectedIndex;
                          const Icon = iconMap[item.icon];

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onMouseEnter={() => setSelectedIndex(index)}
                              onClick={() => handleSubmit(item)}
                              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                                active
                                  ? "border border-primary/25 bg-secondary/70 shadow-sm"
                                  : "border border-transparent hover:bg-secondary/45"
                              }`}
                            >
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/90 text-text-secondary">
                                <Icon className="h-4.5 w-4.5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-text-primary">
                                    {item.title}
                                  </span>
                                  {item.badge ? (
                                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                      {item.badge}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block truncate text-sm text-text-secondary">
                                  {item.description}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                                <span className="hidden max-w-[12rem] truncate md:inline">{item.href}</span>
                                <ChevronRight className="h-4 w-4" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-text-secondary sm:px-5">
              <p>
                {bootstrapLoading || searchIssuesLoading
                  ? "Refreshing suggestions..."
                  : normalizedQuery
                  ? showDynamicResults
                    ? `${flatResults.length} dynamic matches`
                    : `${flatResults.length} page matches`
                  : "Start typing or press / anywhere in the app"}
              </p>
              <p className="hidden sm:block">⌘K or Ctrl+K</p>
            </div>
          </div>
        </div>
      ) : null}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);

  if (!context) {
    throw new Error("useGlobalSearch must be used within a GlobalSearchProvider");
  }

  return context;
}
