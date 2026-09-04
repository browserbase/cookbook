import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Metric {
  id: string;
  label: string;
  value: number;
  unit: string;
  delta: string;
}

type Range = "7d" | "24h" | "30d";

const seeded: Record<Range, Metric[]> = {
  "7d": [
    { id: "req", label: "Requests", value: 184320, unit: "", delta: "+8.2%" },
    { id: "lat", label: "P95 Latency", value: 142, unit: "ms", delta: "-4.1%" },
    { id: "err", label: "Error rate", value: 0.08, unit: "%", delta: "-0.3%" },
    { id: "usr", label: "Active users", value: 2847, unit: "", delta: "+12%" },
  ],
  "24h": [], // INTENTIONAL: empty response triggers the error-like fallback bug
  "30d": [
    { id: "req", label: "Requests", value: 812400, unit: "", delta: "+14%" },
    { id: "lat", label: "P95 Latency", value: 156, unit: "ms", delta: "+2%" },
    { id: "err", label: "Error rate", value: 0.11, unit: "%", delta: "+0.1%" },
    { id: "usr", label: "Active users", value: 9120, unit: "", delta: "+6%" },
  ],
};

async function fetchMetrics(range: Range): Promise<Metric[]> {
  await new Promise((r) => setTimeout(r, 450));
  return seeded[range];
}

const ranges: { value: Range; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "24h", label: "Last 24 hours" },
  { value: "30d", label: "Last 30 days" },
];

export function MetricsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMetrics(range).then((data) => {
      if (cancelled) return;
      setMetrics(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto" data-btc-route="network-empty">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">
            Live performance and usage signals.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[oklch(0.5_0.02_260)]">Range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            data-btc-probe="range-filter"
            className="h-9 rounded-lg border border-[oklch(0.88_0.01_85)] bg-white px-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.1_260)]"
          >
            {ranges.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8" data-btc-probe="results-region">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white animate-pulse"
              />
            ))}
          </div>
        ) : metrics && metrics.length === 0 ? (
          // INTENTIONAL BUG: an empty (but valid) result is treated as a failure
          // and rendered as a destructive error-like fallback instead of a
          // neutral "no data" empty state.
          <div
            data-btc-probe="metrics-error-fallback"
            className="rounded-2xl border border-[oklch(0.85_0.08_25)] bg-[oklch(0.98_0.02_25)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-[oklch(0.92_0.08_25)] flex items-center justify-center text-[oklch(0.45_0.18_25)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-[oklch(0.35_0.15_25)]">
                  Something went wrong
                </h2>
                <p className="mt-1 text-sm text-[oklch(0.45_0.08_25)]">
                  Failed to load metrics. Please try again in a moment.
                </p>
                <div className="mt-4">
                  <Button
                    variant="destructive"
                    onClick={() => setReloadKey((k) => k + 1)}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <MetricsGrid metrics={metrics!} />
        )}
      </div>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  const top = metrics[0];
  const topValue = top.value.toLocaleString();

  return (
    <>
      <div
        className="rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        data-btc-probe="top-metric-card"
      >
        <div className="text-xs uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
          Top metric
        </div>
        <div className="mt-2 text-3xl font-semibold">
          {topValue}{" "}
          <span className="text-base text-[oklch(0.5_0.02_260)]">{top.unit}</span>
        </div>
        <div className="mt-1 text-sm text-[oklch(0.4_0.02_260)]">{top.label}</div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white p-5"
            data-btc-probe="metric-card"
          >
            <div className="text-xs uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
              {m.label}
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {m.value.toLocaleString()}{" "}
              <span className="text-sm text-[oklch(0.5_0.02_260)]">{m.unit}</span>
            </div>
            <div className="mt-1 text-xs text-[oklch(0.45_0.12_145)]">{m.delta}</div>
          </div>
        ))}
      </div>
    </>
  );
}
