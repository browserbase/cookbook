import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { FilesPage } from "./pages/FilesPage";
import { ConsolePage } from "./pages/ConsolePage";
import { MetricsPage } from "./pages/MetricsPage";
import { FolderOpen, LayoutDashboard, LineChart } from "lucide-react";

const navItems = [
  { to: "/a11y-dialog-focus", label: "Dialog Focus", icon: FolderOpen },
  { to: "/visual-hidden-banner", label: "Hidden Banner", icon: LayoutDashboard },
  { to: "/network-empty", label: "Empty Metrics", icon: LineChart },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  // Hide outer shell on console page so its own sticky header sits at top of viewport
  const isConsole = pathname === "/visual-hidden-banner";

  return (
    <div className="min-h-dvh bg-[oklch(0.97_0.01_85)] text-[oklch(0.2_0.02_260)]">
      <div className="flex min-h-dvh">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[oklch(0.9_0.01_85)] bg-[oklch(1_0_0)]">
          <div className="flex items-center gap-2 px-5 py-5 border-b border-[oklch(0.94_0.01_85)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.45_0.12_260)]">
              <span className="text-sm font-bold text-white">B</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">BTC Lab</div>
              <div className="text-[11px] text-[oklch(0.5_0.02_260)]">A11y & Layout</div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[oklch(0.95_0.03_260)] text-[oklch(0.35_0.12_260)]"
                      : "text-[oklch(0.4_0.02_260)] hover:bg-[oklch(0.97_0.01_85)]"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-[oklch(0.94_0.01_85)] text-[11px] text-[oklch(0.55_0.02_260)]">
            Benchmark Suite v1.0
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {isConsole ? children : <div className="h-full">{children}</div>}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/a11y-dialog-focus" replace />} />
          <Route path="/a11y-dialog-focus" element={<FilesPage />} />
          <Route path="/visual-hidden-banner" element={<ConsolePage />} />
          <Route path="/network-empty" element={<MetricsPage />} />
          <Route path="*" element={<Navigate to="/a11y-dialog-focus" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
