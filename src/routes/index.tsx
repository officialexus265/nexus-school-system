import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { NexusMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { isPending } = useCurrentUserState();
  return (
    <div className="min-h-dvh bg-ink text-foam">
      <div className="ledger-grid pointer-events-none fixed inset-0 opacity-30" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <NexusMark className="text-foam" />
          <span className="font-display text-xl font-medium tracking-tight">NEXUS</span>
        </Link>
        <nav className="flex items-center gap-3">
          {isPending ? (
            <div className="h-10 w-28 animate-pulse rounded-md bg-ink-3" />
          ) : (
            <>
              <SignedOut>
                <Link to="/login">
                  <Button variant="ghost" className="text-foam hover:bg-ink-3 hover:text-foam">
                    Sign in
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link to="/app">
                  <Button className="bg-foam text-ink hover:bg-foam/90">Open workspace</Button>
                </Link>
              </SignedIn>
              <SignedOut>
                <Link to="/login">
                  <Button className="bg-foam text-ink hover:bg-foam/90">
                    Enter
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </SignedOut>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-end md:pt-20">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-mist">
              Multi-school operating platform
            </p>
            <h1 className="mt-4 max-w-xl font-display text-5xl font-medium leading-[1.05] tracking-tight text-foam sm:text-6xl md:text-7xl">
              The operating system for schools.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-mist">
              One platform. Isolated tenants. Marks stay draft until an authorised person
              publishes them. Parents see only what the school releases.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isPending ? (
                <div className="h-11 w-40 animate-pulse rounded-md bg-ink-3" />
              ) : (
                <>
                  <SignedIn>
                    <Link to="/app">
                      <Button size="lg" className="bg-foam text-ink hover:bg-foam/90">
                        Continue to desk
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  </SignedIn>
                  <SignedOut>
                    <Link to="/login">
                      <Button size="lg" className="bg-foam text-ink hover:bg-foam/90">
                        Open a workspace
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  </SignedOut>
                </>
              )}
            </div>
          </div>
          <HeroCard />
        </section>

        <section className="border-t border-foam/10">
          <div className="mx-auto grid max-w-6xl gap-px bg-foam/10 md:grid-cols-3">
            {[
              {
                k: "01",
                t: "Tenant isolation",
                d: "Every school is a sealed ledger. Staff, students, fees and marks never leak across campuses.",
              },
              {
                k: "02",
                t: "Permissioned work",
                d: "Roles are collections of permissions. A bursar cannot publish results. A teacher cannot reverse a receipt.",
              },
              {
                k: "03",
                t: "Published, not leaked",
                d: "Draft → submit → review → approve → confirm. Parents are notified only after the last signature.",
              },
            ].map((item) => (
              <div key={item.k} className="bg-ink px-6 py-10">
                <p className="font-mono text-xs text-mist">{item.k}</p>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">{item.t}</h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist">{item.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-mist">Modules</p>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight">A full school desk.</h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["People", "Students, parents, teachers, verified child links."],
              ["Academics", "Years, terms, classes, streams, subjects, assignments."],
              ["Results", "Configurable grading, ranking, locked report cards."],
              ["Attendance", "Daily register with absence alerts to parents."],
              ["Finance", "Charges, allocations, receipts — never silent deletes."],
              ["Behaviour", "Incidents, cases, meetings, parent visibility rules."],
              ["Parent portal", "School colours, only published records."],
              ["Audit", "Money, marks, permissions and publishing events."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-foam/10 bg-ink-2 p-5">
                <h3 className="font-display text-lg font-medium">{t}</h3>
                <p className="mt-1 text-sm text-mist">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-foam/10 px-5 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-sm">NEXUS</p>
            <p className="text-xs text-mist">A configurable school operating platform.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="rounded-2xl bg-paper p-5 text-ink shadow-[var(--shadow-lift)] sm:p-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Publish results
      </p>
      <h3 className="mt-2 font-display text-2xl font-medium tracking-tight">Form 2A · Term 2</h3>
      <dl className="mt-5 space-y-2 text-sm">
        {[
          ["Academic year", "2026"],
          ["Students", "4"],
          ["Mathematics", "Submitted"],
          ["English", "Verified"],
          ["Science", "Draft — blocked"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-line py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Published results become visible to authorised parents. This action is written to the
        audit log and cannot be undone without a reversal.
      </p>
      <div className="mt-5 flex gap-2">
        <span className="flex h-10 flex-1 items-center justify-center rounded-md border border-border text-sm">
          Cancel
        </span>
        <span className="flex h-10 flex-1 items-center justify-center rounded-md bg-ink text-sm text-foam">
          Confirm & publish
        </span>
      </div>
    </div>
  );
}
