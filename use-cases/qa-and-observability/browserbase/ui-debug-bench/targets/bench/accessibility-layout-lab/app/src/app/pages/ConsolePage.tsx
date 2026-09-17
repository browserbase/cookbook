import { useEffect, useState } from "react";
import { Bell, Search, X } from "lucide-react";

export function ConsolePage() {
  const [toastVisible, setToastVisible] = useState(true);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    // Trial banner appears after a longer delay; before this, no overlap exists.
    const t = setTimeout(() => setBannerVisible(true), 3500);
    return () => clearTimeout(t);
  }, []);

  // BUG: trial banner is rendered as fixed-at-top with no spacer compensation,
  // so once it appears (delayed) OR after the toast is dismissed, it overlaps
  // the sticky header. On initial render, neither trigger has fired and layout is correct.
  const overlapping = bannerVisible || toastDismissed;

  return (
    <div
      className="relative min-h-dvh bg-[oklch(0.97_0.01_85)]"
      data-btc-route="visual-hidden-banner"
    >
      {/* Sticky header */}
      <header
        className="fixed top-0 left-0 right-0 md:left-64 z-30 h-16 border-b border-[oklch(0.9_0.01_85)] bg-white/95 backdrop-blur"
        data-btc-probe="sticky-header"
      >
        <div className="h-full px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[oklch(0.45_0.12_260)] flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <div>
              <div className="text-sm font-semibold">Acme Console</div>
              <div className="text-[11px] text-[oklch(0.5_0.02_260)]">Production workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg bg-[oklch(0.96_0.01_85)] border border-[oklch(0.92_0.01_85)] text-sm text-[oklch(0.5_0.02_260)] w-72">
              <Search className="h-4 w-4" />
              Search...
            </div>
            <button className="h-9 w-9 rounded-lg hover:bg-[oklch(0.96_0.01_85)] flex items-center justify-center">
              <Bell className="h-4 w-4 text-[oklch(0.4_0.02_260)]" />
            </button>
            <div className="h-8 w-8 rounded-full bg-[oklch(0.85_0.06_200)]" />
          </div>
        </div>
      </header>

      {/* Spacer so initial layout looks correct under the sticky header */}
      <div className="h-16" />

      {/* Trial banner: fixed at top with NO spacer; overlaps header once visible. */}
      {overlapping && (
        <div
          className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-gradient-to-r from-[oklch(0.7_0.15_55)] to-[oklch(0.65_0.18_35)] text-white shadow-md"
          data-btc-probe="trial-banner"
        >
          <div className="px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 rounded-full px-2.5 py-0.5">
                Trial
              </span>
              <span className="text-sm font-medium">Trial expires in 3 days</span>
              <span className="hidden sm:inline text-sm text-white/80">
                Upgrade to keep your workspace active.
              </span>
            </div>
            <button className="text-sm font-semibold bg-white text-[oklch(0.45_0.15_35)] rounded-md px-3 py-1.5 hover:bg-white/90">
              Upgrade now
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="px-8 py-10" data-btc-probe="main-content">
        <h1 className="text-2xl font-semibold tracking-tight" data-btc-probe="page-title">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">
          Overview of your workspace activity.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Active users", value: "2,847", delta: "+12%" },
            { label: "API requests", value: "1.2M", delta: "+4%" },
            { label: "Error rate", value: "0.08%", delta: "-0.3%" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="text-xs uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 text-xs text-[oklch(0.45_0.12_145)]">{s.delta} this week</div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3 text-sm text-[oklch(0.4_0.02_260)]">
            <li>• Deployment <span className="font-medium text-[oklch(0.2_0.02_260)]">api-v2.4.1</span> succeeded</li>
            <li>• 14 new team members joined this week</li>
            <li>• Database backup completed at 03:00 UTC</li>
            <li>• Auto-scaling policy <span className="font-medium text-[oklch(0.2_0.02_260)]">edge-tier</span> updated</li>
          </ul>
        </div>
      </div>

      {/* Onboarding toast */}
      {toastVisible && (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-[oklch(0.88_0.01_85)] bg-white p-4 shadow-xl flex gap-3"
          data-btc-probe="onboarding-toast"
        >
          <div className="h-9 w-9 shrink-0 rounded-lg bg-[oklch(0.94_0.04_260)] flex items-center justify-center text-[oklch(0.4_0.12_260)] text-sm font-bold">
            ★
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Welcome to Acme Console</div>
            <div className="mt-0.5 text-xs text-[oklch(0.5_0.02_260)]">
              Take the quick tour to set up your workspace.
            </div>
          </div>
          <button
            className="text-[oklch(0.5_0.02_260)] hover:text-[oklch(0.2_0.02_260)]"
            aria-label="Dismiss"
            data-btc-probe="onboarding-toast-dismiss"
            onClick={() => {
              setToastVisible(false);
              setToastDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
