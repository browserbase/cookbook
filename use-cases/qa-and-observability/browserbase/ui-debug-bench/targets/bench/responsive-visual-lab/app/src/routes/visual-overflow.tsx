import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/visual-overflow")({
  head: () => ({
    meta: [
      { title: "Pricing — BTC Visual Lab" },
      { name: "description", content: "Simple, transparent pricing for the BTC platform." },
      { property: "og:title", content: "Pricing — BTC Visual Lab" },
      { property: "og:description", content: "Pick the plan that fits your team." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const [starterOpen, setStarterOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);

  return (
    <div
      data-btc-route="visual-overflow"
      className="min-h-screen bg-gradient-to-b from-background to-muted/40"
    >
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm font-semibold">Pricing</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</span>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start free and upgrade as your team grows. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {/* Starter */}
          <div
            data-btc-probe="plan-card"
            className="rounded-2xl border border-border bg-card p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold">Starter</h2>
            <p className="mt-1 text-sm text-muted-foreground">For individuals exploring the platform.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">$12</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Up to 3 projects</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Community support</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Basic analytics</li>
            </ul>

            <button
              type="button"
              data-btc-probe="plan-details-toggle"
              onClick={() => setStarterOpen((v) => !v)}
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {starterOpen ? "Hide plan details" : "Show plan details"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", starterOpen && "rotate-180")} />
            </button>

            {starterOpen && (
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
                <p>Billed monthly. Cancel anytime from your account settings.</p>
                <p>Includes email support with a 48-hour response time.</p>
                <p>Soft limit of 10,000 API requests per month.</p>
              </div>
            )}

            <button className="mt-8 w-full rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-muted">
              Choose Starter
            </button>
          </div>

          {/* Pro */}
          <div
            data-btc-probe="plan-card"
            className="rounded-2xl border border-primary/30 bg-card p-8 shadow-md ring-1 ring-primary/20"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Pro</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Most popular</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">For growing teams that need more power.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">$48</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited projects</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Priority support</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Advanced analytics & exports</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> SSO and audit logs</li>
            </ul>

            <button
              type="button"
              data-btc-probe="plan-details-toggle"
              onClick={() => setProOpen((v) => !v)}
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {proOpen ? "Hide plan details" : "Show plan details"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", proOpen && "rotate-180")} />
            </button>

            {proOpen && (
              <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm text-muted-foreground">
                <p>Includes dedicated onboarding and a 99.9% uptime SLA.</p>
                <p>Custom data retention policies and exportable audit trails.</p>
                <p>Volume discounts available for annual commitments.</p>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-medium text-foreground">Annual billing</span>
                  <span>Save 20% — $460 / year</span>
                </div>
              </div>
            )}

            {proOpen ? (
              <div className="mt-8 flex">
                <button
                  data-btc-probe="pro-cta"
                  className="min-w-[380px] whitespace-nowrap rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Upgrade to Pro — Start your 14-day free trial
                </button>
              </div>
            ) : (
              <button
                data-btc-probe="pro-cta"
                className="mt-8 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
