import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mobile-nav")({
  head: () => ({
    meta: [
      { title: "Docs — BTC Visual Lab" },
      { name: "description", content: "Documentation for the BTC Visual Lab with responsive navigation." },
      { property: "og:title", content: "Docs — BTC Visual Lab" },
      { property: "og:description", content: "Read the BTC Visual Lab documentation." },
    ],
  }),
  component: MobileNav,
});

function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div data-btc-route="mobile-nav" className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            BTC Docs
          </Link>

          {/* Desktop nav */}
          <nav
            data-btc-probe="desktop-nav"
            className="nav-links hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex"
          >
            <a href="#" className="hover:text-foreground">Home</a>
            <a href="#" className="hover:text-foreground">Docs</a>
            <a href="#" className="hover:text-foreground">Account</a>
          </nav>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            data-btc-probe="nav-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted md:hidden"
          >
            <Menu
              className={cn(
                "absolute h-4 w-4 transition-all duration-200",
                menuOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100",
              )}
            />
            <X
              className={cn(
                "absolute h-4 w-4 transition-all duration-200",
                menuOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0",
              )}
            />
          </button>
        </div>

        {/* Mobile menu panel */}
        <div
          data-btc-probe="mobile-menu"
          className={cn(
            "mobile-menu border-t border-border bg-background",
            menuOpen ? "md:block" : "hidden",
          )}
        >
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-5 py-3 text-sm font-medium">
            <a href="#" className="rounded-md px-3 py-2 hover:bg-muted">Home</a>
            <a href="#" className="rounded-md px-3 py-2 hover:bg-muted">Docs</a>
            <a href="#" className="rounded-md px-3 py-2 hover:bg-muted">Account</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Getting started</span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Welcome to the BTC Docs</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The BTC platform helps teams ship better interfaces faster. This guide walks
          through installation, configuration, and the core building blocks of the system.
        </p>

        <section className="mt-10 space-y-6">
          <article className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Installation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add the package to your project and import the styles. Configuration is
              minimal — most projects work out of the box with sensible defaults.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Configuration</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tune themes, breakpoints, and motion preferences through a single config
              file. Each option is documented with examples and recommended defaults.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Core concepts</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Learn how layouts, tokens, and primitives compose into reusable patterns
              that scale across product surfaces.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
