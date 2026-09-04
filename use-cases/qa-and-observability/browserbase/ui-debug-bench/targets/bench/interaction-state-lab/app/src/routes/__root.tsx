import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { FlaskConical, Plus, ListFilter, Layers } from "lucide-react";

import appCss from "../styles.css?url";
import { reportAppBuilderError } from "../lib/error-reporting";
import { cn } from "@/lib/utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/functional-counter"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to lab
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportAppBuilderError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BTC Interaction & State Lab" },
      { name: "description", content: "An interactive lab for UI state experiments." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/functional-counter", label: "Functional Counter", icon: Plus },
  { to: "/functional-filter", label: "Functional Filter", icon: ListFilter },
  { to: "/state-tab-loss", label: "State Tab Loss", icon: Layers },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/30">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur">
            <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-foreground">BTC Lab</span>
                <span className="text-xs text-muted-foreground">Interaction & State</span>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  )}
                  activeProps={{
                    className:
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-5 py-4 border-t border-border text-xs text-muted-foreground">
              v1.0 · demo build
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/70 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary md:hidden" />
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  BTC Interaction & State Lab
                </h1>
              </div>
              {/* Mobile nav */}
              <nav className="flex md:hidden gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    activeProps={{
                      className:
                        "rounded-md px-2 py-1 text-xs bg-primary text-primary-foreground",
                    }}
                  >
                    {item.label.split(" ")[1] ?? item.label}
                  </Link>
                ))}
              </nav>
            </header>
            <main className="flex-1 px-6 py-8 md:px-10 md:py-12">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}
