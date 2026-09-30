import { Link, Outlet, useRouterState, Navigate } from "@tanstack/react-router";
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
  ScrollText,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { NexusWordmark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useSnapshot } from "@/hooks/use-snapshot";
import { useNexusSession } from "@/stores/session";
import { exportSchoolDataBundle } from "@/lib/nexus/server";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon };

/** Super admin — platform only (no school operations). */
const PLATFORM_NAV: NavItem[] = [
  { to: "/app/platform", label: "Schools", icon: Building2 },
  { to: "/app/invoices", label: "Invoices", icon: Wallet },
  { to: "/app/health", label: "Health", icon: Shield },
  { to: "/app/tools", label: "Tools", icon: Settings },
];

/** School owner / head — full school operations. */
const SCHOOL_NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/students", label: "Students", icon: GraduationCap },
  { to: "/app/people", label: "Staff & parents", icon: Users },
  { to: "/app/academics", label: "Academics", icon: BookOpen },
  { to: "/app/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/app/results", label: "Results", icon: ClipboardCheck },
  { to: "/app/behaviour", label: "Behaviour", icon: Shield },
  { to: "/app/finance", label: "Finance", icon: Wallet },
  { to: "/app/ledger", label: "Ledger", icon: ScrollText },
  { to: "/app/announcements", label: "Notices", icon: Megaphone },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/documents", label: "Documents", icon: BookOpen },
  { to: "/app/admissions", label: "Admissions", icon: GraduationCap },
  { to: "/app/setup", label: "Setup wizard", icon: Settings },
  { to: "/app/tools", label: "Tools", icon: Settings },
  { to: "/app/roles", label: "Roles", icon: Shield },
  { to: "/app/status", label: "Health", icon: Shield },
  { to: "/app/settings", label: "School", icon: Settings },
];

/** Classroom teacher — limited to teaching day-to-day. */
const TEACHER_NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/students", label: "My students", icon: GraduationCap },
  { to: "/app/attendance", label: "Register", icon: CalendarDays },
  { to: "/app/results", label: "Marks / results", icon: ClipboardCheck },
  { to: "/app/behaviour", label: "Behaviour", icon: Shield },
  { to: "/app/announcements", label: "Notices", icon: Megaphone },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/documents", label: "Documents", icon: BookOpen },
];

/** Bursar — fees focused. */
const BURSAR_NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/students", label: "Students", icon: GraduationCap },
  { to: "/app/finance", label: "Finance", icon: Wallet },
  { to: "/app/ledger", label: "Ledger", icon: ScrollText },
  { to: "/app/announcements", label: "Notices", icon: Megaphone },
];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active =
          item.to === "/app"
            ? pathname === "/app" || pathname === "/app/"
            : pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0 opacity-70" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({
  items,
  title,
  subtitle,
  onNavigate,
}: {
  items: NavItem[];
  title: string;
  subtitle: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-5 pt-1">
        <Link to="/" onClick={onNavigate}>
          <NexusWordmark />
        </Link>
        <p className="mt-3 px-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
        <p className="px-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <NavLinks items={items} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function AppShell() {
  const user = useCurrentUser();
  const snap = useSnapshot();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const isPlatform = Boolean(snap.data?.isPlatformOwner);
  const schoolName =
    snap.data?.school?.id && snap.data.school.id !== "none"
      ? snap.data.school.name
      : null;
  const schoolLocked = Boolean(snap.data?.schoolLocked);
  const lockReason = (snap.data as { lockReason?: string | null } | undefined)?.lockReason;
  const subscriptionWarning = (snap.data as { subscriptionWarning?: string | null } | undefined)
    ?.subscriptionWarning;


  const setSchoolSlug = useNexusSession((s) => s.setSchoolSlug);
  const schools = snap.data?.schools || [];
  const role = (snap.data?.membershipRole || "owner").toLowerCase();

  const items = isPlatform
    ? PLATFORM_NAV
    : role === "teacher" || role === "exam"
      ? TEACHER_NAV
      : role === "bursar"
        ? BURSAR_NAV
        : SCHOOL_NAV;
  const sideTitle = isPlatform ? "Platform" : schoolName || "School";
  const sideSubtitle = isPlatform
    ? "Super admin"
    : schoolName
      ? role === "teacher"
        ? "Teacher workspace"
        : role === "bursar"
          ? "Bursar workspace"
          : role === "head"
            ? "Head teacher"
            : "School workspace"
      : "No school linked yet";

  // Platform owners should live on platform routes, not school overview by default
  if (
    !snap.isPending &&
    isPlatform &&
    (pathname === "/app" || pathname === "/app/")
  ) {
    return <Navigate to="/app/platform" />;
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/30 lg:block">
        <Sidebar items={items} title={sideTitle} subtitle={sideSubtitle} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <Sidebar
                items={items}
                title={sideTitle}
                subtitle={sideSubtitle}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {isPlatform
                ? "NEXUS Platform"
                : schoolName || "NEXUS"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {isPlatform
                ? "Create and bill schools"
                : snap.data?.school?.status === "DELETED_PENDING_PURGE"
                  ? "School scheduled for deletion — export your data"
                  : schoolLocked
                    ? "Account suspended — contact system owner"
                    : schoolName
                      ? "School management"
                      : "Awaiting school assignment"}
            </p>
            {!isPlatform && schools.length > 1 && (
              <select
                className="mt-1 max-w-xs rounded border border-border bg-background px-2 py-1 text-xs"
                value={snap.data?.school?.slug || ""}
                onChange={(e) => {
                  setSchoolSlug(e.target.value);
                  window.location.reload();
                }}
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Button variant="ghost" size="icon" className="relative" type="button">
            <Bell className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name || user?.email || "Account"}
            </span>
            <UserButton />
          </div>
        </header>

        {snap.data?.school?.status === "DELETED_PENDING_PURGE" && (
          <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-950 dark:text-amber-100">
            <p>
              This school was closed by the platform. You have until{" "}
              <strong>
                {(snap.data.school as { purge_after?: string }).purge_after
                  ? new Date(
                      (snap.data.school as { purge_after?: string }).purge_after!,
                    ).toLocaleString()
                  : "the end of the 14-day window"}
              </strong>{" "}
              to download your records. After that, all data is permanently removed and cannot be
              recovered.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={async () => {
                try {
                  const data = await exportSchoolDataBundle({
                    data: { schoolId: snap.data!.school.id },
                  });
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${snap.data!.school.slug || "school"}-export.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Download started");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Export failed");
                }
              }}
            >
              Download school data
            </Button>
          </div>
        )}
        {schoolLocked && snap.data?.school?.status !== "DELETED_PENDING_PURGE" && (
          <div className="border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-sm text-red-800 dark:text-red-200">
            This school is suspended. You can view limited data; changes are blocked until the
            system owner reactivates the account.
          </div>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {schoolLocked && !isPlatform && (
            <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <strong>Operations limited.</strong>{" "}
              {lockReason || "This school cannot process changes until the account is active."}
              {" "}
              <a href="/app/settings" className="underline font-medium">
                Open Billing / Settings
              </a>
            </div>
          )}
          {!schoolLocked && subscriptionWarning && !isPlatform && (
            <div className="border-b border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm">
              <strong>Subscription notice.</strong> {subscriptionWarning}{" "}
              <a href="/app/settings" className="underline font-medium">
                Billing
              </a>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
