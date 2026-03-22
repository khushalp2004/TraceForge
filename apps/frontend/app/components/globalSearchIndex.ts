export type GlobalSearchItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  group: "Pages" | "Docs" | "Quick actions";
  icon:
    | "page"
    | "doc"
    | "spark"
    | "issue"
    | "alert"
    | "project"
    | "org"
    | "billing"
    | "settings";
  keywords: string[];
  badge?: string;
};

export const GLOBAL_STATIC_SEARCH_ITEMS: GlobalSearchItem[] = [
  {
    id: "page-product",
    title: "Product",
    description: "Explore TraceForge product capabilities and workflows.",
    href: "/product",
    group: "Pages",
    icon: "page",
    keywords: ["product", "features", "capabilities", "workflow"]
  },
  {
    id: "page-pricing",
    title: "Pricing",
    description: "Review plans, usage, and billing details.",
    href: "/pricing",
    group: "Pages",
    icon: "billing",
    keywords: ["pricing", "plans", "cost", "billing"]
  },
  {
    id: "page-solutions",
    title: "Solutions",
    description: "See how TraceForge fits reliability and engineering teams.",
    href: "/solutions",
    group: "Pages",
    icon: "spark",
    keywords: ["solutions", "teams", "use cases", "engineering"]
  },
  {
    id: "page-about",
    title: "About",
    description: "Read the product story and positioning.",
    href: "/about",
    group: "Pages",
    icon: "page",
    keywords: ["about", "company", "story"]
  },
  {
    id: "page-blog",
    title: "Blog",
    description: "Browse product notes and engineering updates.",
    href: "/blog",
    group: "Pages",
    icon: "doc",
    keywords: ["blog", "articles", "updates", "engineering"]
  },
  {
    id: "page-overview",
    title: "Overview",
    description: "Open the dashboard overview and recent errors.",
    href: "/dashboard",
    group: "Pages",
    icon: "page",
    keywords: ["dashboard", "overview", "home", "recent errors", "notifications"]
  },
  {
    id: "page-issues",
    title: "Issues",
    description: "Review grouped runtime issues and AI summaries.",
    href: "/dashboard/issues",
    group: "Pages",
    icon: "issue",
    keywords: ["issues", "errors", "exceptions", "runtime", "triage"]
  },
  {
    id: "page-projects",
    title: "Projects",
    description: "Manage projects, API keys, and archived workspaces.",
    href: "/dashboard/projects",
    group: "Pages",
    icon: "project",
    keywords: ["projects", "api key", "workspace", "keys"]
  },
  {
    id: "page-releases",
    title: "Releases",
    description: "Correlate deploys with issue spikes and regression windows.",
    href: "/dashboard/releases",
    group: "Pages",
    icon: "page",
    keywords: ["releases", "deploys", "version", "release health"]
  },
  {
    id: "page-insights",
    title: "Insights",
    description: "See overall trends, environment health, and signal summaries.",
    href: "/dashboard/insights",
    group: "Pages",
    icon: "spark",
    keywords: ["insights", "trends", "analytics", "health"]
  },
  {
    id: "page-alerts",
    title: "Alerts",
    description: "Create alert rules and review recent trigger activity.",
    href: "/dashboard/alerts",
    group: "Pages",
    icon: "alert",
    keywords: ["alerts", "rules", "notify", "notifications", "critical"]
  },
  {
    id: "page-orgs",
    title: "Organization",
    description: "Manage organizations, members, and approvals.",
    href: "/dashboard/orgs",
    group: "Pages",
    icon: "org",
    keywords: ["organization", "team", "members", "invite", "access"]
  },
  {
    id: "page-settings",
    title: "Workspace Settings",
    description: "Configure integrations and workspace-level controls.",
    href: "/dashboard/settings",
    group: "Pages",
    icon: "settings",
    keywords: ["settings", "integrations", "workspace", "slack", "jira", "pagerduty"]
  },
  {
    id: "page-account",
    title: "Account Details",
    description: "Edit profile, appearance, password, and account actions.",
    href: "/dashboard/account/details",
    group: "Pages",
    icon: "settings",
    keywords: ["account", "profile", "theme", "password", "appearance"]
  },
  {
    id: "page-billing",
    title: "Billing",
    description: "Review plan, usage, invoices, and billing controls.",
    href: "/dashboard/billing",
    group: "Pages",
    icon: "billing",
    keywords: ["billing", "plan", "usage", "invoices", "subscription"]
  },
  {
    id: "page-docs",
    title: "Documentation",
    description: "Open the developer docs and setup guides.",
    href: "/docs",
    group: "Pages",
    icon: "doc",
    keywords: ["docs", "documentation", "guide", "reference", "sdk"]
  },
  {
    id: "doc-quickstart",
    title: "Docs: Quickstart",
    description: "Install the SDK and send your first event.",
    href: "/docs",
    group: "Docs",
    icon: "doc",
    keywords: ["quickstart", "install", "sdk", "first event", "getting started"]
  },
  {
    id: "doc-release-tagging",
    title: "Docs: Release tagging",
    description: "Learn how to tag environments and releases correctly.",
    href: "/docs",
    group: "Docs",
    icon: "doc",
    keywords: ["release tagging", "release", "environment", "deploy", "version"]
  },
  {
    id: "doc-ingest",
    title: "Docs: Direct ingest payload",
    description: "Send backend errors directly to the ingest endpoint.",
    href: "/docs",
    group: "Docs",
    icon: "doc",
    keywords: ["ingest", "payload", "api", "backend", "capture"]
  },
  {
    id: "action-notifications",
    title: "Open notifications",
    description: "Jump to the dashboard with the notifications panel open.",
    href: "/dashboard?notifications=open",
    group: "Quick actions",
    icon: "spark",
    keywords: ["notifications", "bell", "invite", "requests", "alerts"],
    badge: "Action"
  },
  {
    id: "action-create-project",
    title: "Create project",
    description: "Open projects and create a new monitored app.",
    href: "/dashboard/projects",
    group: "Quick actions",
    icon: "project",
    keywords: ["create project", "new project", "workspace", "monitor app"],
    badge: "Action"
  },
  {
    id: "action-create-org",
    title: "Create organization",
    description: "Open organizations and create a new team space.",
    href: "/dashboard/orgs",
    group: "Quick actions",
    icon: "org",
    keywords: ["create organization", "new organization", "team"],
    badge: "Action"
  },
  {
    id: "action-review-alerts",
    title: "Review alert rules",
    description: "Open alert rules and recent trigger activity.",
    href: "/dashboard/alerts",
    group: "Quick actions",
    icon: "alert",
    keywords: ["notify", "review alerts", "critical", "rules"],
    badge: "Action"
  },
  {
    id: "action-signin",
    title: "Sign in",
    description: "Open the sign-in page.",
    href: "/signin",
    group: "Quick actions",
    icon: "settings",
    keywords: ["sign in", "login", "authenticate"],
    badge: "Action"
  },
  {
    id: "action-signup",
    title: "Create account",
    description: "Open signup and create a TraceForge account.",
    href: "/signup",
    group: "Quick actions",
    icon: "spark",
    keywords: ["signup", "register", "create account", "start trial"],
    badge: "Action"
  }
];
