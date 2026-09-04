import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus, ShoppingCart, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/functional-counter")({
  head: () => ({
    meta: [
      { title: "Functional Counter · BTC Lab" },
      { name: "description", content: "Cart quantity stepper demo." },
    ],
  }),
  component: FunctionalCounter,
});

const UNIT_PRICE = 129;

function FunctionalCounter() {
  const [qty, setQty] = useState(2);

  const clamp = (n: number) => Math.max(1, Math.min(99, n));

  // Minus behaves normally.
  const handleDecrement = () => setQty((q) => clamp(q - 1));

  // Planted bug: plus uses a subtle off-by-two that decrements instead of increments.
  // Looks like q + 1 at a glance because of the `+ 1` token, but the `- 2` wins.
  const handleIncrement = () => setQty((q) => clamp(q + 1 - 2));

  const subtotal = UNIT_PRICE * qty;
  const shipping = qty > 0 ? 9 : 0;
  const total = subtotal + shipping;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div data-btc-route="functional-counter" className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Your cart
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your items before checkout.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden p-0" data-btc-probe="cart-list">
          <div className="border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1 item
          </div>

          <div
            data-btc-probe="cart-row"
            className="flex flex-col gap-5 px-6 py-6 md:flex-row md:items-center"
          >
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-secondary text-4xl">
              🎧
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-current" />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">(248)</span>
              </div>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Aurora Wireless Headphones
              </h3>
              <p className="text-xs text-muted-foreground">
                Midnight black · 40h battery
              </p>
              <div
                className="mt-1 text-sm text-muted-foreground"
                data-btc-probe="unit-price"
              >
                {fmt(UNIT_PRICE)} <span className="opacity-60">/ unit</span>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div
                className="inline-flex items-center rounded-lg border border-border bg-background shadow-sm"
                data-btc-probe="quantity-stepper"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Decrease quantity"
                  data-btc-probe="quantity-decrement"
                  onClick={handleDecrement}
                  className="h-9 w-9 rounded-l-lg rounded-r-none"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div
                  className="w-10 text-center text-sm font-semibold tabular-nums"
                  data-btc-probe="quantity-value"
                >
                  {qty}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Increase quantity"
                  data-btc-probe="quantity-increment"
                  onClick={handleIncrement}
                  className="h-9 w-9 rounded-r-lg rounded-l-none"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="w-24 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Subtotal
                </div>
                <div
                  className="text-base font-semibold text-foreground tabular-nums"
                  data-btc-probe="row-subtotal"
                >
                  {fmt(subtotal)}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove item"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="h-fit p-6" data-btc-probe="order-summary">
          <h3 className="text-sm font-semibold text-foreground">Order summary</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd className="tabular-nums" data-btc-probe="summary-subtotal">
                {fmt(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Shipping</dt>
              <dd className="tabular-nums">{fmt(shipping)}</dd>
            </div>
            <div className="my-3 h-px bg-border" />
            <div className="flex justify-between text-base font-semibold text-foreground">
              <dt>Total</dt>
              <dd className="tabular-nums" data-btc-probe="summary-total">
                {fmt(total)}
              </dd>
            </div>
          </dl>
          <Button className="mt-5 w-full" size="lg">
            <ShoppingCart className="h-4 w-4" />
            Checkout
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Free returns within 30 days
          </p>
        </Card>
      </div>
    </div>
  );
}
