import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { LogOut, User, Settings, CreditCard, KeyRound, Bell } from "lucide-react";

export const Route = createFileRoute("/auth-logout")({
  head: () => ({ meta: [{ title: "Account · BTC Lab" }] }),
  component: AccountPage,
});

function AccountPage() {
  const [signedIn, setSignedIn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // INTENTIONAL BUG (subtle): handler closes the menu and surfaces a toast,
  // but never actually clears auth state. Looks like logout worked.
  const handleLogout = () => {
    setMenuOpen(false);
    toast.success("Signed out", { description: "You've been signed out of this device." });
  };

  return (
    <div data-btc-route="/auth-logout" className="px-6 md:px-12 py-10 max-w-5xl">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and session.</p>
        </div>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              data-btc-probe="user-menu"
              className="flex items-center gap-3 rounded-full border border-border bg-card pl-1 pr-3 py-1 hover:bg-accent transition"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">MC</AvatarFallback>
              </Avatar>
              <div className="text-left leading-tight">
                <div className="text-sm font-medium">Maya Chen</div>
                <div className="text-xs text-muted-foreground">maya@btc.lab</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem><User className="h-4 w-4" /> Profile</DropdownMenuItem>
            <DropdownMenuItem><Settings className="h-4 w-4" /> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-btc-probe="logout-button" onSelect={handleLogout}>
              <LogOut className="h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-8">
        {/* Protected sidebar — only meant for signed-in users */}
        {signedIn && (
          <aside data-btc-probe="protected-sidebar" className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground px-3 pb-2">
              Workspace
            </div>
            {[
              { icon: User, label: "Profile" },
              { icon: CreditCard, label: "Billing" },
              { icon: KeyRound, label: "Security" },
              { icon: Bell, label: "Notifications" },
              { icon: Settings, label: "Settings" },
            ].map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="#"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" /> {label}
              </a>
            ))}
          </aside>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Welcome back, Maya</CardTitle>
            <CardDescription>
              You're signed in as <span className="font-medium text-foreground">maya@btc.lab</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 text-sm">
              <div className="text-muted-foreground">Last sign-in</div>
              <div className="font-medium">Today at 09:14 from London, UK</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Manage devices</Button>
              <Button
                variant="ghost"
                onClick={() => setSignedIn(false)}
                className="text-muted-foreground"
              >
                End all sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
