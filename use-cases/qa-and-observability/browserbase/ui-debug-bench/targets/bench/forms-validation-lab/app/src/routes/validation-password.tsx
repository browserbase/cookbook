import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/app-layout";
import { KeyRound, CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/validation-password")({
  head: () => ({
    meta: [
      { title: "Password Validation Lab — BTC Forms & Validation Lab" },
      { name: "description", content: "Reset-password form fixture for benchmarking password validation detection." },
    ],
  }),
  component: PasswordValidationPage,
});

type Strength = { score: number; label: string; color: string };

function scorePassword(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  // Cosmetic only — never used to block submit
  if (pw.length === 0) return { score: 0, label: "—", color: "bg-muted" };
  if (score <= 1) return { score: 20, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score: 50, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score: 75, label: "Good", color: "bg-sky-500" };
  return { score: 100, label: "Strong", color: "bg-emerald-500" };
}

function PasswordValidationPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [updated, setUpdated] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // INTENTIONAL BUG: only checks non-empty + match, no genuine length/strength requirement
    if (password.trim().length === 0) return;
    if (password !== confirm) return;
    setUpdated(true);
  }

  return (
    <AppLayout>
      <div data-btc-route="validation-password" className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Password Validation Lab</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Reset password</h2>
          <p className="mt-3 text-base text-muted-foreground">
            A password reset fixture used to benchmark how tools detect missing minimum-length or strength enforcement.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Choose a new password</CardTitle>
                <CardDescription>You'll use this password the next time you sign in.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {updated ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                <h3 className="mt-3 text-lg font-semibold text-emerald-900">Password updated</h3>
                <p className="mt-1 text-sm text-emerald-800">Your password has been changed successfully.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => { setUpdated(false); setPassword(""); setConfirm(""); }}
                >
                  Change again
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    data-btc-probe="password"
                    type="password"
                    placeholder="Enter a new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                  />
                  <div className="pt-1">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${strength.color}`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Password strength</span>
                      <span className="font-medium text-foreground">{strength.label}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    data-btc-probe="confirm"
                    type="password"
                    placeholder="Re-enter your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-11"
                    aria-invalid={mismatch || undefined}
                  />
                  {mismatch && (
                    <p className="text-xs text-red-600">Passwords don't match.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  data-btc-probe="submit"
                  className="w-full h-11"
                  disabled={password.length === 0 || confirm.length === 0 || mismatch}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Update password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
