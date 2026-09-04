import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  FileText,
  Activity,
  Save,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/state-tab-loss")({
  head: () => ({
    meta: [
      { title: "State Tab Loss · BTC Lab" },
      { name: "description", content: "Customer detail page with tabs." },
    ],
  }),
  component: StateTabLoss,
});

type Tab = "overview" | "notes" | "activity";

function StateTabLoss() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div data-btc-route="state-tab-loss" className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Customer
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview, notes, and recent activity.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div
          className="flex items-center gap-4 border-b border-border bg-accent/30 px-6 py-5"
          data-btc-probe="profile-header"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-lg font-semibold text-primary-foreground">
            EM
          </div>
          <div className="flex-1">
            <div
              className="text-lg font-semibold text-foreground"
              data-btc-probe="profile-name"
            >
              Elena Martínez
            </div>
            <div
              className="text-sm text-muted-foreground"
              data-btc-probe="profile-company"
            >
              Acme Industries · Customer since 2023
            </div>
          </div>
          <div className="hidden md:flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5" data-btc-probe="profile-email">
              <Mail className="h-3.5 w-3.5" />
              elena@acme.co
            </div>
            <div className="flex items-center gap-1.5" data-btc-probe="profile-phone">
              <Phone className="h-3.5 w-3.5" />
              +1 (555) 010-2233
            </div>
            <div className="flex items-center gap-1.5" data-btc-probe="profile-location">
              <MapPin className="h-3.5 w-3.5" />
              Madrid, ES
            </div>
          </div>
        </div>

        <div
          className="flex border-b border-border px-2"
          data-btc-probe="tab-list"
          role="tablist"
        >
          <TabBtn
            active={tab === "overview"}
            onClick={() => setTab("overview")}
            probe="tab-trigger-overview"
            icon={<User className="h-4 w-4" />}
          >
            Overview
          </TabBtn>
          <TabBtn
            active={tab === "notes"}
            onClick={() => setTab("notes")}
            probe="tab-trigger-notes"
            icon={<FileText className="h-4 w-4" />}
          >
            Notes
          </TabBtn>
          <TabBtn
            active={tab === "activity"}
            onClick={() => setTab("activity")}
            probe="tab-trigger-activity"
            icon={<Activity className="h-4 w-4" />}
          >
            Activity
          </TabBtn>
        </div>

        <div className="p-6" data-btc-probe="tab-panel">
          {/* Planted bug: each panel is its own component with local state, so
              switching tabs unmounts NotesPanel and the draft is lost. */}
          {tab === "overview" && <OverviewPanel />}
          {tab === "notes" && <NotesPanel />}
          {tab === "activity" && <ActivityPanel />}
        </div>
      </Card>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  probe,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  probe: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      data-btc-probe={probe}
      className={cn(
        "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );
}

function OverviewPanel() {
  const stats = [
    { label: "Plan", value: "Business" },
    { label: "MRR", value: "$1,240" },
    { label: "Seats", value: "24 / 30" },
    { label: "Renewal", value: "Sep 12" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-border bg-background/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {s.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function NotesPanel() {
  // Planted bug: local-only state. Unmounts on tab switch → draft lost.
  const [draft, setDraft] = useState("");

  return (
    <div data-btc-probe="notes-panel">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Draft note
      </label>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a note about Elena…"
        data-btc-probe="note-textarea"
        className="mt-2 min-h-40 resize-none"
      />
      <div className="mt-3 flex items-center justify-between">
        <span
          className="text-xs text-muted-foreground"
          data-btc-probe="note-char-count"
        >
          {draft.length} characters
        </span>
        <Button size="sm" data-btc-probe="note-save">
          <Save className="h-4 w-4" />
          Save note
        </Button>
      </div>
    </div>
  );
}

const ACTIVITY = [
  { t: "2h ago", title: "Email opened", body: "Opened ‘Q3 renewal options’ email." },
  { t: "Yesterday", title: "Plan upgraded", body: "Switched from Pro to Business plan." },
  { t: "3 days ago", title: "Support ticket closed", body: "‘SAML config’ resolved by Jordan." },
  { t: "Last week", title: "Invoice paid", body: "Paid invoice #2024-0488 ($1,240)." },
];

function ActivityPanel() {
  return (
    <ol className="relative space-y-5 pl-6" data-btc-probe="activity-list">
      <span className="absolute left-2 top-1 bottom-1 w-px bg-border" />
      {ACTIVITY.map((a, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-medium text-foreground">{a.title}</div>
            <div className="text-xs text-muted-foreground">{a.t}</div>
          </div>
          <div className="text-sm text-muted-foreground">{a.body}</div>
        </li>
      ))}
    </ol>
  );
}
