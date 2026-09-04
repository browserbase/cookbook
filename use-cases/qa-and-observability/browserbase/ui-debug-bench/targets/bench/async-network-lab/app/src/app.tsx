import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban,
  Search as SearchIcon,
  BarChart3,
  Loader2,
  Map,
  Rocket,
  AlertTriangle,
  RefreshCw,
  Zap,
} from "lucide-react";

const navItems = [
  { to: "/async-loading", label: "Projects", icon: FolderKanban },
  { to: "/async-race", label: "Search", icon: SearchIcon },
  { to: "/network-retry", label: "Reports", icon: BarChart3 },
];

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    document.title = "BTC Async & Network Lab";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full blur-[140px] opacity-20 pointer-events-none"
        style={{ backgroundColor: "var(--color-primary)" }}
      />
      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border/60 bg-card/40 backdrop-blur-sm p-5 hidden md:flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15 text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Lab
              </div>
              <div className="font-semibold tracking-tight leading-tight">
                BTC Async &<br />Network Lab
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto text-xs text-muted-foreground/60">
            v1.0 — benchmark harness
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 backdrop-blur-md bg-background/70 border-b border-border/60">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
              <h1 className="text-lg font-semibold tracking-tight">
                BTC Async & Network Lab
              </h1>
              {/* Mobile nav */}
              <nav className="flex md:hidden gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `p-2 rounded-md ${
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                  </NavLink>
                ))}
              </nav>
            </div>
          </header>
          <div className="max-w-4xl mx-auto px-6 py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <div className="text-xs font-medium tracking-wider uppercase text-primary mb-2">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

/* ───────────── /async-loading ───────────── */

const projectsData = [
  {
    id: "1",
    name: "Roadmap",
    description: "Strategic planning and milestones for Q3–Q4 initiatives.",
    icon: <Map className="w-5 h-5" />,
    status: "In Progress",
    tasks: 12,
  },
  {
    id: "2",
    name: "Launch plan",
    description: "Go-to-market coordination, rollout sequencing and metrics.",
    icon: <Rocket className="w-5 h-5" />,
    status: "Planning",
    tasks: 8,
  },
];

function AsyncLoadingPage() {
  const [projectsVisible, setProjectsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setProjectsVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div data-btc-route="async-loading">
      <PageHeader
        eyebrow="Async loading"
        title="Projects"
        description="Live project tracker with real-time status updates."
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold tracking-tight">All projects</h3>
          {/* Subtle lingering indicator — never resolves */}
          <span
            data-btc-probe="sync-indicator"
            className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground/50"
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Syncing…</span>
          </span>
        </div>
        <div className="text-xs text-muted-foreground/70">
          {projectsData.length} projects
        </div>
      </div>

      <div className="space-y-4">
        {projectsVisible &&
          projectsData.map((p, idx) => (
            <motion.div
              key={p.id}
              data-btc-probe="project-row"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="rounded-xl border border-border bg-card p-5 hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold tracking-tight">{p.name}</h4>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{p.tasks} tasks</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span>Updated just now</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  );
}

/* ───────────── /async-race ───────────── */

const searchItems = [
  "alpha brief",
  "beta roadmap",
  "beta budget",
  "gamma report",
  "delta overview",
];

function fakeSearch(q: string): Promise<string[]> {
  // Latency depends on query content → out-of-order resolves.
  const lower = q.toLowerCase();
  let delay = 350;
  if (lower.includes("alpha")) delay = 800;
  else if (lower.includes("beta")) delay = 200;
  else if (lower.includes("gamma")) delay = 500;
  else if (lower.includes("delta")) delay = 300;

  return new Promise((resolve) => {
    setTimeout(() => {
      if (!q) return resolve(searchItems);
      resolve(
        searchItems.filter((item) => item.toLowerCase().includes(lower)),
      );
    }, delay);
  });
}

function AsyncRacePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>(searchItems);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    // No cancellation / no request id — last-resolved wins.
    fakeSearch(next).then((r) => setResults(r));
  };

  return (
    <div data-btc-route="async-race">
      <PageHeader
        eyebrow="Async race"
        title="Search"
        description="Filter project artifacts as you type."
      />
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-btc-probe="search-input"
            value={query}
            onChange={handleChange}
            placeholder="Search items…"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
          />
        </div>
        <div className="mt-6 space-y-2" data-btc-probe="results">
          {results.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No results
            </div>
          ) : (
            results.map((r) => (
              <div
                key={r}
                data-btc-probe="result-row"
                className="px-4 py-3 rounded-lg bg-surface-elevated border border-border/60 text-sm"
              >
                {r}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────── /network-retry ───────────── */

function NetworkRetryPage() {
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const data: string | null = null;
  const error = "Network error";

  const handleRetry = () => {
    if (retrying) return;
    setAttempts((a) => a + 1);
    setRetrying(true);
    // Looks like a retry, but recovery always silently fails.
    setTimeout(() => {
      setRetrying(false);
    }, 1000);
  };

  return (
    <div data-btc-route="network-retry">
      <PageHeader
        eyebrow="Network retry"
        title="Reports"
        description="Quarterly performance fetched from the reporting service."
      />
      <div className="rounded-xl border border-border bg-card p-8">
        {data ? (
          <div
            data-btc-probe="report"
            className="text-2xl font-semibold tracking-tight"
          >
            {data}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/15 text-destructive mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div data-btc-probe="error" className="text-lg font-semibold">
              {error}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              We couldn't reach the reporting service.
            </p>
            <button
              data-btc-probe="retry-button"
              onClick={handleRetry}
              disabled={retrying}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70"
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Retrying…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </>
              )}
            </button>
            <div className="mt-4 text-xs text-muted-foreground">
              Attempts:{" "}
              <span data-btc-probe="attempts" className="font-mono">
                {attempts}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/async-loading" replace />} />
          <Route path="/async-loading" element={<AsyncLoadingPage />} />
          <Route path="/async-race" element={<AsyncRacePage />} />
          <Route path="/network-retry" element={<NetworkRetryPage />} />
          <Route
            path="*"
            element={<Navigate to="/async-loading" replace />}
          />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
