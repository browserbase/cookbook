import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, ShieldCheck, ShieldAlert, LogIn } from "lucide-react";

export const Route = createFileRoute("/auth-guard")({
  head: () => ({ meta: [{ title: "Billing · BTC Lab" }] }),
  component: BillingPage,
});

function BillingPage() {
  const [signedIn, setSignedIn] = useState(false);

  return (
    <div data-btc-route="/auth-guard" className="px-6 md:px-12 py-10 max-w-4xl">
      {/* Header / top bar — clearly shows auth status */}
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Your plan, payment method and invoices.</p>
        </div>
        <div className="flex items-center gap-3">
          {signedIn ? (
            <Badge data-btc-probe="auth-status" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Signed in
            </Badge>
          ) : (
            <Badge data-btc-probe="auth-status" variant="secondary" className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> Signed out
            </Badge>
          )}
          <Button
            data-btc-probe="signin-button"
            onClick={() => setSignedIn((s) => !s)}
            variant={signedIn ? "outline" : "default"}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            {signedIn ? "Sign out" : "Sign in"}
          </Button>
        </div>
      </div>

      {/* Front-and-center: innocuous public plan overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pro plan</CardTitle>
          <CardDescription>Everything your team needs to ship benchmarks.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <li>• Unlimited test runs</li>
            <li>• Priority queue</li>
            <li>• Shared workspaces</li>
            <li>• Email support</li>
          </ul>
        </CardContent>
      </Card>

      {/* Tabs — protected detail lives inside the non-default "Details" tab */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>This month</CardTitle>
              <CardDescription>A quick snapshot of your account activity.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-muted-foreground">Runs</div><div className="text-xl font-semibold">128</div></div>
              <div><div className="text-muted-foreground">Seats</div><div className="text-xl font-semibold">4</div></div>
              <div><div className="text-muted-foreground">Status</div><div className="text-xl font-semibold">Active</div></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>Aggregate usage for the current billing cycle.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Detailed usage graphs will appear here.
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTENTIONAL BUG (subtle): Details tab renders protected billing data
            unconditionally — not gated on `signedIn`. Visible only when this
            tab is opened, but real and reproducible. */}
        <TabsContent value="details" className="mt-4">
          <Card data-btc-probe="protected-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Payment & invoices</CardTitle>
              </div>
              <CardDescription>Account billing details on file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="text-sm text-muted-foreground">Visa</div>
                <div className="font-mono text-lg">Card ending 4242</div>
                <div className="text-xs text-muted-foreground mt-1">Exp 09 / 2028</div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-sm text-muted-foreground mb-1">Billing address</div>
                <div className="text-sm">Maya Chen · 221B Baker St · London NW1 6XE</div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <div className="text-sm text-muted-foreground">Next invoice</div>
                  <div className="font-medium">July 1, 2026</div>
                </div>
                <div className="text-xl font-semibold">$49.00</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
