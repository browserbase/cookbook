import { createFileRoute, Link } from "@tanstack/react-router";
import { Menu, Table2, LayoutPanelLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BTC Responsive Visual Lab" },
      { name: "description", content: "A lab of responsive UI demos across mobile, tables, and pricing layouts." },
      { property: "og:title", content: "BTC Responsive Visual Lab" },
      { property: "og:description", content: "Explore responsive UI demos across mobile navigation, data tables, and pricing." },
    ],
  }),
  component: Home,
});

const demos = [
  {
    to: "/mobile-nav",
    title: "Mobile Navigation",
    description: "A documentation header with a collapsible menu for small screens.",
    icon: Menu,
    tag: "Navigation",
  },
  {
    to: "/mobile-table",
    title: "Invoice Table",
    description: "A dense invoice table designed to adapt across viewports.",
    icon: Table2,
    tag: "Data",
  },
  {
    to: "/visual-overflow",
    title: "Pricing Plans",
    description: "Side-by-side pricing cards with clear calls to action.",
    icon: LayoutPanelLeft,
    tag: "Marketing",
  },
] as const;

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">B</div>
            <span className="font-semibold tracking-tight">BTC Visual Lab</span>
          </div>
          <span className="text-xs text-muted-foreground">Responsive benchmark suite</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            v1.0 — Demo
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Responsive Visual Lab
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            A small collection of polished interface patterns used to evaluate
            responsive behavior across navigation, tabular data, and pricing layouts.
          </p>
        </section>

        <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <Link
              key={d.to}
              to={d.to}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <d.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {d.tag}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{d.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open demo
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
