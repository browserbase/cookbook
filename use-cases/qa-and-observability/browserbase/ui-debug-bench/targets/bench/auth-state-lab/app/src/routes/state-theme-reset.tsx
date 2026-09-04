import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/state-theme-reset")({
  head: () => ({ meta: [{ title: "Preferences · BTC Lab" }] }),
  component: PreferencesPage,
});

type Prefs = {
  theme: "light" | "dark";
  emailDigest: boolean;
  compactMode: boolean;
  betaFeatures: boolean;
};

const DEFAULT_PREFS: Prefs = {
  theme: "light",
  emailDigest: true,
  compactMode: false,
  betaFeatures: false,
};

function PreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>({ ...DEFAULT_PREFS, theme: "light" });
  const [sheetOpen, setSheetOpen] = useState(false);

  const isDark = prefs.theme === "dark";

  // INTENTIONAL BUG (subtle): updating any setting from the sheet merges over
  // DEFAULT_PREFS (which has theme: "light"), silently resetting the theme.
  const updateSetting = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs({ ...DEFAULT_PREFS, ...{ [key]: value } });
  };

  return (
    <div
      data-btc-route="/state-theme-reset"
      className={cn(
        "min-h-screen transition-colors",
        isDark ? "bg-zinc-950 text-zinc-50" : "bg-background text-foreground"
      )}
    >
      <div className="px-6 md:px-12 py-10 max-w-3xl">
        <div className={cn("mb-8 flex items-start justify-between gap-4 border-b pb-6", isDark ? "border-zinc-800" : "border-border")}>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Preferences</h1>
            <p className={cn("mt-1", isDark ? "text-zinc-400" : "text-muted-foreground")}>
              Customize how the workspace looks and feels.
            </p>
          </div>
          <Button
            data-btc-probe="settings-trigger"
            onClick={() => setSheetOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Settings className="h-4 w-4" /> Settings
          </Button>
        </div>

        <Card className={cn(isDark && "bg-zinc-900 border-zinc-800 text-zinc-50")}>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription className={cn(isDark && "text-zinc-400")}>
              Choose a theme for the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div data-btc-probe="theme-toggle" className="flex gap-3">
              <button
                onClick={() => setPrefs((p) => ({ ...p, theme: "light" }))}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg border p-4 transition",
                  !isDark
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <Sun className="h-4 w-4" /> Light
              </button>
              <button
                onClick={() => setPrefs((p) => ({ ...p, theme: "dark" }))}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg border p-4 transition",
                  isDark
                    ? "border-primary ring-2 ring-primary/30 bg-primary/10"
                    : "border-border hover:border-primary/40"
                )}
              >
                <Moon className="h-4 w-4" /> Dark
              </button>
            </div>
            <div className={cn("mt-6 text-sm", isDark ? "text-zinc-400" : "text-muted-foreground")}>
              Current theme: <span className="font-medium">{prefs.theme}</span>
            </div>
          </CardContent>
        </Card>

        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (open) {
            // INTENTIONAL BUG (subtle): opening the drawer resets theme to light.
            setPrefs((p) => ({ ...p, theme: "light" }));
          }
        }}>
          <SheetContent data-btc-probe="settings-drawer">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>Adjust general workspace settings.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="digest">Email digest</Label>
                  <p className="text-xs text-muted-foreground">Weekly summary of activity.</p>
                </div>
                <Switch
                  id="digest"
                  checked={prefs.emailDigest}
                  onCheckedChange={(v) => updateSetting("emailDigest", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compact">Compact mode</Label>
                  <p className="text-xs text-muted-foreground">Tighter spacing across the UI.</p>
                </div>
                <Switch
                  id="compact"
                  checked={prefs.compactMode}
                  onCheckedChange={(v) => updateSetting("compactMode", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="beta">Beta features</Label>
                  <p className="text-xs text-muted-foreground">Try experimental functionality.</p>
                </div>
                <Switch
                  id="beta"
                  checked={prefs.betaFeatures}
                  onCheckedChange={(v) => updateSetting("betaFeatures", v)}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
