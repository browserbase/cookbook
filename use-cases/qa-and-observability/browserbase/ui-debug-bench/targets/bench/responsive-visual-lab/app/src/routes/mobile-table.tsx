import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/mobile-table")({
  head: () => ({
    meta: [
      { title: "Invoices — BTC Visual Lab" },
      { name: "description", content: "An invoice table demonstrating responsive tabular layouts." },
      { property: "og:title", content: "Invoices — BTC Visual Lab" },
      { property: "og:description", content: "Browse invoices in the BTC Visual Lab." },
    ],
  }),
  component: InvoiceTable,
});

const rows = [
  { id: "INV-1049", client: "Northstar Analytics Incorporated", amount: "$2,400", status: "Pending approval" },
  { id: "INV-1048", client: "Brightline Logistics", amount: "$980", status: "Paid" },
  { id: "INV-1047", client: "Helios Manufacturing Group", amount: "$5,120", status: "Paid" },
  { id: "INV-1046", client: "Cobalt Studios", amount: "$1,250", status: "Overdue" },
  { id: "INV-1045", client: "Meridian Health Partners", amount: "$3,700", status: "Paid" },
];

function statusClass(s: string) {
  if (s.startsWith("Paid")) return "bg-emerald-100 text-emerald-700";
  if (s.startsWith("Overdue")) return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function InvoiceTable() {
  return (
    <div data-btc-route="mobile-table" className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm font-semibold">Invoices</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Recent invoices</h1>
        <p className="mt-2 text-muted-foreground">
          Track invoice status across your active clients.
        </p>

        {/* Mobile: card list */}
        <div
          data-btc-probe="invoice-list"
          className="mt-8 space-y-3 md:hidden"
        >
          {rows.map((r) => (
            <div
              key={r.id}
              data-btc-probe="invoice-card"
              className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div
                data-btc-probe="invoice-row"
                className="flex min-w-[460px] items-center gap-6"
              >
                <div className="whitespace-nowrap text-sm font-semibold text-foreground">
                  {r.id}
                </div>
                <div className="whitespace-nowrap text-sm text-muted-foreground">
                  {r.client}
                </div>
                <div className="whitespace-nowrap text-sm font-medium">
                  {r.amount}
                </div>
                <div className="whitespace-nowrap">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: regular table */}
        <div className="mt-8 hidden rounded-2xl border border-border bg-card shadow-sm md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Invoice ID</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-foreground">{r.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">{r.client}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium">{r.amount}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
