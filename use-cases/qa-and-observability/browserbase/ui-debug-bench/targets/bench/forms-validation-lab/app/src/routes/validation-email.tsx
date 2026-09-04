import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/app-layout";
import { Mail, CheckCircle2, Send, UserPlus, ShieldCheck, Eye } from "lucide-react";

export const Route = createFileRoute("/validation-email")({
  head: () => ({
    meta: [
      { title: "Email Validation Lab — BTC Forms & Validation Lab" },
      { name: "description", content: "Invite-a-teammate form fixture for benchmarking email validation detection." },
    ],
  }),
  component: EmailValidationPage,
});

const roles = [
  { value: "member", label: "Member", description: "Can view and edit shared resources.", icon: UserPlus },
  { value: "admin", label: "Admin", description: "Full access including billing and team management.", icon: ShieldCheck },
  { value: "viewer", label: "Viewer", description: "Read-only access to shared content.", icon: Eye },
];

function EmailValidationPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [sendNow, setSendNow] = useState(false);
  const [sent, setSent] = useState(false);

  const gateSatisfied = role !== "" || sendNow;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!gateSatisfied) return;
    // INTENTIONAL BUG: only checks non-empty, no @ / domain validation
    if (email.trim().length > 0) {
      setSent(true);
    }
  }

  return (
    <AppLayout>
      <div data-btc-route="validation-email" className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Email Validation Lab</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Invite a teammate</h2>
          <p className="mt-3 text-base text-muted-foreground">
            A multi-step invite form fixture used to benchmark how tools detect missing or incomplete email validation in real product UI.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Send an invite</CardTitle>
                <CardDescription>Pick a role, then we'll email them a link to join your workspace.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                <h3 className="mt-3 text-lg font-semibold text-emerald-900">Invite sent</h3>
                <p className="mt-1 text-sm text-emerald-800">
                  We sent an invitation to <span className="font-medium">{email}</span>
                  {role && <> as <span className="font-medium">{roles.find(r => r.value === role)?.label}</span></>}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => { setSent(false); setEmail(""); setRole(""); setSendNow(false); }}
                >
                  Send another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="invite-role">
                    Step 1 · Choose a role
                  </Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger
                      id="invite-role"
                      data-btc-probe="role"
                      className="h-11"
                    >
                      <SelectValue placeholder="Select a role for this teammate" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => {
                        const Icon = r.icon;
                        return (
                          <SelectItem key={r.value} value={r.value}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{r.label}</span>
                              <span className="text-xs text-muted-foreground">— {r.description}</span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-email">Step 2 · Teammate's email</Label>
                  <Input
                    id="invite-email"
                    data-btc-probe="email"
                    type="text"
                    placeholder="teammate@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="send-now" className="text-sm font-medium">Send invite now</Label>
                    <p className="text-xs text-muted-foreground">Off saves it as a draft you can send later.</p>
                  </div>
                  <Switch
                    id="send-now"
                    data-btc-probe="send-now"
                    checked={sendNow}
                    onCheckedChange={setSendNow}
                  />
                </div>

                {!gateSatisfied && (
                  <p className="text-xs text-muted-foreground">Choose a role to continue.</p>
                )}

                <Button
                  type="submit"
                  data-btc-probe="submit"
                  className="w-full h-11"
                  disabled={!gateSatisfied}
                >
                  <Send className="h-4 w-4" />
                  Invite
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
