import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Mail, KeyRound, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { to: "/a11y-label", label: "A11y Label", icon: BookOpen },
  { to: "/validation-email", label: "Email Validation", icon: Mail },
  { to: "/validation-password", label: "Password Validation", icon: KeyRound },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/a11y-label" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                BTC Forms &amp; Validation Lab
              </h1>
              <p className="text-xs text-muted-foreground">Benchmark / QA Console</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border bg-card mt-12">
        <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} BTC Forms &amp; Validation Lab — Benchmark fixtures.
        </div>
      </footer>
    </div>
  );
}
