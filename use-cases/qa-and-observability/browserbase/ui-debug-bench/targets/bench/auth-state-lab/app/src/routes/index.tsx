import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, UserCircle2, Settings2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BTC Auth & State Lab" },
      { name: "description", content: "Benchmark scenarios for auth guards and state resets." },
    ],
  }),
  component: Index,
});

const cards = [
  { to: "/auth-guard", title: "Billing", desc: "Auth-guarded billing details scenario.", icon: CreditCard },
  { to: "/auth-logout", title: "Account", desc: "Sign-out flow benchmark.", icon: UserCircle2 },
  { to: "/state-theme-reset", title: "Preferences", desc: "Theme persistence across UI events.", icon: Settings2 },
] as const;

function Index() {
  return (
    <div className="px-6 md:px-12 py-10 md:py-16 max-w-5xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Benchmark lab · 3 scenarios
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          BTC Auth &amp; State Lab
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl">
          A small testbed of authentication guards and UI state behaviors. Pick a scenario to inspect its runtime behavior.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group">
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
              <CardHeader>
                <c.icon className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="flex items-center justify-between">
                  {c.title}
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                </CardTitle>
                <CardDescription>{c.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
