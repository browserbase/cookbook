import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppLayout } from "@/components/app-layout";
import {
  Search,
  Settings,
  Shield,
  Zap,
  BarChart3,
  Users,
  FileText,
  Terminal,
  ChevronRight,
  Clock,
  Tag,
  SlidersHorizontal,
  Plus,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";

export const Route = createFileRoute("/a11y-label")({
  head: () => ({
    meta: [
      { title: "Accessibility Label Lab — BTC Forms & Validation Lab" },
      { name: "description", content: "Knowledge base search demo used to benchmark accessibility label detection." },
    ],
  }),
  component: A11yLabelPage,
});

const categories = [
  { name: "Getting Started", icon: Zap, count: 12 },
  { name: "Account & Billing", icon: Users, count: 8 },
  { name: "Security", icon: Shield, count: 15 },
  { name: "API Reference", icon: Terminal, count: 24 },
  { name: "Integrations", icon: Settings, count: 10 },
  { name: "Analytics", icon: BarChart3, count: 6 },
];

const articles = [
  { title: "Quick Start Guide", description: "Get up and running in under 5 minutes with our streamlined onboarding flow.", category: "Getting Started", readTime: "4 min read", tag: "Popular" },
  { title: "Understanding Authentication Flows", description: "Learn how OAuth 2.0, SAML, and API keys work within the platform.", category: "Security", readTime: "8 min read", tag: "Updated" },
  { title: "REST API Best Practices", description: "Design patterns, rate limiting, and error handling for production integrations.", category: "API Reference", readTime: "12 min read", tag: null },
  { title: "Webhook Configuration", description: "Set up real-time event notifications with signature verification and retry policies.", category: "Integrations", readTime: "6 min read", tag: "New" },
  { title: "Dashboard Analytics Overview", description: "Navigate metrics, custom reports, and data export options from the console.", category: "Analytics", readTime: "5 min read", tag: null },
  { title: "Team Permissions & Roles", description: "Configure RBAC, custom roles, and audit logging for enterprise teams.", category: "Account & Billing", readTime: "7 min read", tag: "Popular" },
  { title: "Troubleshooting 500 Errors", description: "Common causes, diagnostic steps, and escalation paths for server errors.", category: "API Reference", readTime: "10 min read", tag: null },
  { title: "Data Retention Policies", description: "Understand how long data is stored and how to configure custom retention rules.", category: "Security", readTime: "4 min read", tag: "Updated" },
  { title: "CSV Import & Export", description: "Bulk operations, schema mapping, and validation for spreadsheet workflows.", category: "Getting Started", readTime: "6 min read", tag: null },
];

const tagStyles: Record<string, string> = {
  Popular: "bg-amber-100 text-amber-800 border-amber-200",
  New: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Updated: "bg-sky-100 text-sky-800 border-sky-200",
};

function A11yLabelPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filteredArticles = articles.filter((article) => {
    const matchesQuery =
      query.trim() === "" ||
      article.title.toLowerCase().includes(query.toLowerCase()) ||
      article.description.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === null || article.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <AppLayout>
      <div data-btc-route="a11y-label" className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Accessibility Label Lab</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Knowledge Base Console</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse and filter knowledge base articles. This page is a fixture for benchmarking how tools detect form-control accessibility labels.
          </p>
        </div>

        {/* Command / Filter toolbar */}
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
          {/* Icon-only search — INTENTIONAL BUG: no accessible name */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-btc-probe="search"
              type="search"
              placeholder="Filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Filter by category">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={activeCategory === null}
                  onCheckedChange={() => setActiveCategory(null)}
                >
                  All categories
                </DropdownMenuCheckboxItem>
                {categories.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.name}
                    checked={activeCategory === c.name}
                    onCheckedChange={() => setActiveCategory(c.name)}
                  >
                    {c.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9 w-[140px]" aria-label="Sort articles">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="popular">Most popular</SelectItem>
                <SelectItem value="alpha">A–Z</SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:flex items-center rounded-md border border-border bg-background">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={`flex h-9 w-9 items-center justify-center rounded-l-md transition-colors ${view === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={`flex h-9 w-9 items-center justify-center rounded-r-md transition-colors ${view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>

            <Button size="sm" className="h-9">
              <Plus className="h-4 w-4" />
              New article
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeCategory === null ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4" />All Articles</span>
                  <span className={`text-xs ${activeCategory === null ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{articles.length}</span>
                </button>
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.name}
                      onClick={() => setActiveCategory(cat.name)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        activeCategory === cat.name ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{cat.name}</span>
                      <span className={`text-xs ${activeCategory === cat.name ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{cat.count}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""}
                {activeCategory ? ` in ${activeCategory}` : ""}
                {query.trim() ? ` matching "${query}"` : ""}
              </h3>
            </div>

            <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>
              {filteredArticles.map((article) => (
                <Card key={article.title} className="group cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">{article.title}</CardTitle>
                      {article.tag && (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagStyles[article.tag] || "bg-muted text-muted-foreground border-border"}`}>
                          {article.tag}
                        </span>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 text-sm leading-relaxed">{article.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{article.category}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{article.readTime}</span>
                  </CardContent>
                  <div className="flex items-center px-6 pb-4">
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      Read article<ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-4 text-base font-semibold text-foreground">No articles found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or category filter.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(""); setActiveCategory(null); }}>Clear filters</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
