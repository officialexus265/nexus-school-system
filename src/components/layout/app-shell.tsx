import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { NexusWordmark } from "@/components/brand/mark";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { PERSONAS, useNexusSession, type Persona } from "@/stores/session";
import type { LucideIcon } from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon };

const OWNER_NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/students", label: "Students", icon: GraduationCap },
  { to: "/app/people", label: "Staff & parents", icon: Users },
  { to: "/app/academics", label: "Academics", icon: BookOpen },
  { to: "/app/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/app/results", label: "Results", icon: ClipboardCheck },
  { to: "/app/behaviour", label: "Behaviour", icon: Shield },
  { to: "/app/finance", label: "Finance", icon: Wallet },
  { to: "/app/announcements", label: "Notices", icon: Megaphone },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/documents", label: "Documents", icon: BookOpen },
  { to: "/app/admissions", label: "Admissions", icon: GraduationCap },
  { to: "/app/setup", label: "Setup wizard", icon: Settings },
  { to: "/app/tools", label: "Tools", icon: Settings },
  { to: "/app/settings", label: "School", icon: Settings },
];

const NAV_BY_PERSONA: Record<Persona, NavItem[]> = {
  owner: OWNER_NAV,
  head: OWNER_NAV.filter((i) => i.to !== "/app/settings"),
  teacher: [
    { to: "/app", label: "My classes", icon: LayoutDashboard },
    { to: "/app/attendance", label: "Attendance", icon: CalendarDays },
    { to: "/app/academics", label: "Assessments", icon: BookOpen },
    { to: "/app/results", label: "Marks", icon: ClipboardCheck },
    { to: "/app/behaviour", label: "Behaviour", icon: Shield },
    { to: "/app/students", label: "Students", icon: GraduationCap },
  ],
  exam: [
    { to: "/app", label: "Exam office", icon: LayoutDashboard },
    { to: "/app/results", label: "Submissions", icon: ClipboardCheck },
    { to: "/app/academics", label: "Assessments", icon: BookOpen },
    { to: "/app/students", label: "Students", icon: GraduationCap },
  ],
  bursar: [
    { to: "/app", label: "Finance", icon: LayoutDashboard },
    { to: "/app/finance", label: "Fees & payments", icon: Wallet },
    { to: "/app/students", label: "Students", icon: GraduationCap },
    { to: "/app/announcements", label: "Notices", icon: Megaphone },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/documents", label: "Documents", icon: BookOpen },
  { to: "/app/admissions", label: "Admissions", icon: GraduationCap },
  ],
  parent: [],
  platform: [
    { to: "/app/platform", label: "Platform", icon: Building2 },
    { to: "/app/invoices", label: "Invoices", icon: Wallet },
    { to: "/app", label: "Sunrise ops", icon: LayoutDashboard },
  ],
};

function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active =
          item.to === "/app"
            ? pathname === "/app"
            : pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to + item.label}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PersonaSwitch() {
  // Demo role tour — off by default. Set VITE_DEMO_PERSONAS=true to re-enable.
  const demoPersonas = import.meta.env.VITE_DEMO_PERSONAS === "true";
  const persona = useNexusSession((s) => s.persona);
  const setPersona = useNexusSession((s) => s.setPersona);
  if (!demoPersonas) {
    return (
      <div className="rounded-lg bg-card px-2.5 py-2 text-xs text-muted-foreground shadow-[var(--shadow-border)]">
        Signed in · use Platform or school menus
      </div>
    );
  }
  const current = PERSONAS.find((p) => p.id === persona)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
        >
          <Avatar name={current.label} tone="teal" className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">{current.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">View as</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Enter a role</DropdownMenuLabel>
        {PERSONAS.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => {
              setPersona(p.id);
              if (p.id === "parent") window.location.hash = "";
            }}
          >
            <span className="flex flex-col">
              <span>{p.label}</span>
              <span className="text-[11px] text-muted-foreground">{p.blurb}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Roles are a tour of the same school, not separate logins.</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const persona = useNexusSession((s) => s.persona);
  const items = NAV_BY_PERSONA[persona];
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-5 pt-1">
        <Link to="/" onClick={onNavigate}>
          <NexusWordmark />
        </Link>
        <p className="mt-3 px-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          NEXUS
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <NavLinks items={items} onNavigate={onNavigate} />
      </div>
      <div className="space-y-3 p-3">
        <PersonaSwitch />
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const persona = useNexusSession((s) => s.persona);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (persona === "parent") {
    return <ParentChrome />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-paper md:flex md:flex-col">
        <Sidebar />
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-paper/90 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <Sidebar onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <NexusWordmark />
          </div>
          <p className="hidden truncate text-sm text-muted-foreground md:block">
            {pathname === "/app" ? "Today · 15 September 2026 · Term 2" : "Sunrise Academy · Lilongwe"}
          </p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/app/announcements"
              className="relative grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
            </Link>
            <div className="hidden sm:block">
              <UserButton />
            </div>
            <div className="sm:hidden">
              <Avatar name={user?.displayName ?? "You"} tone="ink" />
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ParentChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setPersona = useNexusSession((s) => s.setPersona);
  const tabs = [
    { to: "/app", label: "Home", icon: LayoutDashboard },
    { to: "/app/results", label: "Results", icon: ClipboardCheck },
    { to: "/app/attendance", label: "Attend.", icon: CalendarDays },
    { to: "/app/finance", label: "Fees", icon: Wallet },
    { to: "/app/announcements", label: "Notices", icon: Megaphone },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/documents", label: "Documents", icon: BookOpen },
  { to: "/app/admissions", label: "Admissions", icon: GraduationCap },
  ];
  return (
    <div className="min-h-dvh bg-ink text-foam">
      <header className="sticky top-0 z-20 border-b border-foam/10 bg-ink/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="font-display text-lg font-medium tracking-tight">Sunrise Academy</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Parent portal · Agnes Banda</p>
          </div>
          <button
            type="button"
            onClick={() => setPersona("owner")}
            className="text-xs text-mist underline-offset-4 hover:text-foam hover:underline"
          >
            School desk
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-foam/10 bg-ink/95 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.to === "/app" ? pathname === "/app" : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-wide",
                  active ? "text-foam" : "text-mist",
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
