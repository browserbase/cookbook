import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/functional-filter")({
  head: () => ({
    meta: [
      { title: "Functional Filter · BTC Lab" },
      { name: "description", content: "Task list with filters demo." },
    ],
  }),
  component: FunctionalFilter,
});

type Task = { id: number; title: string; project: string; completed: boolean };

const SEED: Task[] = [
  { id: 1, title: "Draft Q3 product brief", project: "Roadmap", completed: false },
  { id: 2, title: "Review pull request #482", project: "Platform", completed: true },
  { id: 3, title: "Sync with design on onboarding", project: "Growth", completed: false },
  { id: 4, title: "Publish changelog for v2.4", project: "Marketing", completed: true },
  { id: 5, title: "Schedule customer interviews", project: "Research", completed: false },
  { id: 6, title: "Archive stale Linear tickets", project: "Ops", completed: true },
  { id: 7, title: "Prepare board update deck", project: "Exec", completed: false },
  { id: 8, title: "Migrate analytics events to v2", project: "Platform", completed: true },
];

type Filter = "all" | "active" | "completed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

function FunctionalFilter() {
  const [tasks, setTasks] = useState<Task[]>(SEED);
  const [filter, setFilter] = useState<Filter>("all");

  const toggle = (id: number) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const counts = useMemo(
    () => ({
      all: tasks.length,
      active: tasks.filter((t) => !t.completed).length,
      completed: tasks.filter((t) => t.completed).length,
    }),
    [tasks],
  );

  // Lookup map of predicates by filter key. Looks tidy and symmetric, but the
  // "completed" predicate is the planted bug — it returns active tasks.
  const predicates: Record<Filter, (t: Task) => boolean> = {
    all: () => true,
    active: (t) => !t.completed,
    completed: (t) => !t.completed,
  };

  const visible = tasks.filter(predicates[filter]);

  return (
    <div data-btc-route="functional-filter" className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Tasks
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your team's work, filtered by status.
        </p>
      </div>

      <Card className="p-2" data-btc-probe="task-card">
        <div
          className="flex items-center gap-1 p-2"
          data-btc-probe="filter-tabs"
          role="tablist"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              data-btc-probe={`filter-tab-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
              <span
                data-btc-probe={`filter-count-${f.key}`}
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  filter === f.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-border" data-btc-probe="task-list">
          {visible.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No tasks to show.
            </div>
          ) : (
            visible.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                data-btc-probe="task-item"
                data-task-id={t.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    t.completed
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                >
                  {t.completed ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Circle className="h-3 w-3 opacity-0" />
                  )}
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    t.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                  data-btc-probe="task-title"
                >
                  {t.title}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t.project}
                </span>
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
