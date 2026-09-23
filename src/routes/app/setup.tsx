import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  getSetupProgress,
  publishParentApp,
  saveWizardAcademics,
  updateSchool,
  updateSetupProgress,
} from "@/lib/nexus/server";

export const Route = createFileRoute("/app/setup")({ component: SetupWizardPage });

type StepKey =
  | "profile"
  | "branding"
  | "academics"
  | "grading"
  | "fees"
  | "behaviour"
  | "parent_app";

const STEPS: { key: StepKey; progressKey: string; title: string; blurb: string }[] = [
  { key: "profile", progressKey: "profile_done", title: "School profile", blurb: "Contact details and motto" },
  { key: "branding", progressKey: "branding_done", title: "Branding", blurb: "Logo mark and colours" },
  { key: "academics", progressKey: "academics_done", title: "Academics", blurb: "Select classes and subjects" },
  { key: "grading", progressKey: "grading_done", title: "Grading", blurb: "Confirm grading approach" },
  { key: "fees", progressKey: "fees_done", title: "Fees", blurb: "Confirm fee structures exist" },
  { key: "behaviour", progressKey: "behaviour_done", title: "Behaviour", blurb: "Discipline categories ready" },
  { key: "parent_app", progressKey: "parent_app_done", title: "Parent app", blurb: "Publish branded parent portal" },
];

/** Malawi-style class catalogue — multi-select, no maximum, at least one required */
const PRIMARY_CLASSES = [
  { id: "p1", section: "Primary", name: "Standard 1", label: "Standard / class / grade 1", level: 1 },
  { id: "p2", section: "Primary", name: "Standard 2", label: "Standard / class / grade 2", level: 2 },
  { id: "p3", section: "Primary", name: "Standard 3", label: "Standard / class / grade 3", level: 3 },
  { id: "p4", section: "Primary", name: "Standard 4", label: "Standard / class / grade 4", level: 4 },
  { id: "p5", section: "Primary", name: "Standard 5", label: "Standard / class / grade 5", level: 5 },
  { id: "p6", section: "Primary", name: "Standard 6", label: "Standard / class / grade 6", level: 6 },
  { id: "p7", section: "Primary", name: "Standard 7", label: "Standard / class / grade 7", level: 7 },
  { id: "p8", section: "Primary", name: "Standard 8", label: "Standard / class / grade 8", level: 8 },
] as const;

const SECONDARY_CLASSES = [
  { id: "s1", section: "Secondary", name: "Form 1", label: "Form 1 / grade 9", level: 9 },
  { id: "s2", section: "Secondary", name: "Form 2", label: "Form 2 / grade 10", level: 10 },
  { id: "s3", section: "Secondary", name: "Form 3", label: "Form 3 / grade 11", level: 11 },
  { id: "s4", section: "Secondary", name: "Form 4", label: "Form 4 / grade 12", level: 12 },
  { id: "s5", section: "Secondary", name: "Form 5", label: "Form 5 / grade 13", level: 13 },
  { id: "s6", section: "Secondary", name: "Form 6", label: "Form 6 / grade 14", level: 14 },
] as const;

const ALL_CLASS_OPTIONS = [...PRIMARY_CLASSES, ...SECONDARY_CLASSES];

const DEFAULT_SUBJECTS = [
  { name: "Mathematics", code: "MATH" },
  { name: "English", code: "ENG" },
  { name: "Science", code: "SCI" },
  { name: "Chichewa", code: "CHI" },
  { name: "Social Studies", code: "SS" },
  { name: "Bible Knowledge", code: "BK" },
  { name: "Agriculture", code: "AGR" },
  { name: "Life Skills", code: "LS" },
];

function SetupWizardPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const navigate = useNavigate();
  const school = q.data?.school;
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const [motto, setMotto] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [logoMark, setLogoMark] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [appName, setAppName] = useState("");

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    "Mathematics",
    "English",
    "Science",
  ]);

  useEffect(() => {
    if (!school) return;
    setMotto(school.motto ?? "");
    setPhone(school.phone ?? "");
    setEmail(school.email ?? "");
    setLogoMark(school.logo_mark ?? school.name.slice(0, 2).toUpperCase());
    setPrimaryColor(school.primary_color ?? "#0f766e");
    setAppName(school.parent_app_name ?? `${school.name} Parent`);
    getSetupProgress({ data: { schoolId: school.id } })
      .then((p) => {
        setProgress({
          profile_done: p.profile_done,
          branding_done: p.branding_done,
          academics_done: p.academics_done,
          grading_done: p.grading_done,
          fees_done: p.fees_done,
          behaviour_done: p.behaviour_done,
          parent_app_done: p.parent_app_done,
        });
        // Jump to first incomplete step
        const keys = STEPS.map((s) => s.progressKey);
        const firstIncomplete = keys.findIndex((k) => !p[k as keyof typeof p]);
        if (firstIncomplete >= 0) setStep(firstIncomplete);
      })
      .catch(() => {});
  }, [school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!school || school.id === "none") {
    return (
      <p className="text-sm text-muted-foreground">
        No school linked. Platform owners open schools from Platform; school owners use the invite
        link.
      </p>
    );
  }

  const current = STEPS[step]!;

  async function markDone(progressKey: string) {
    await updateSetupProgress({
      data: {
        schoolId: school!.id,
        step: progressKey as
          | "profile_done"
          | "branding_done"
          | "academics_done"
          | "grading_done"
          | "fees_done"
          | "behaviour_done"
          | "parent_app_done",
        done: true,
      },
    });
    setProgress((p) => ({ ...p, [progressKey]: true }));
  }

  function toggleClass(id: string) {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSubject(name: string) {
    setSelectedSubjects((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }

  async function handleNext() {
    setBusy(true);
    try {
      if (current.key === "profile") {
        await updateSchool({
          data: { schoolId: school.id, motto, phone, email },
        });
        await markDone("profile_done");
        toast.success("Profile saved");
      } else if (current.key === "branding") {
        await publishParentApp({
          data: {
            schoolId: school.id,
            appName: appName || `${school.name} Parent`,
            primaryColor,
            logoMark,
          },
        });
        await markDone("branding_done");
        toast.success("Branding saved");
      } else if (current.key === "academics") {
        if (selectedClassIds.length < 1) {
          toast.error("Select at least one class");
          setBusy(false);
          return;
        }
        const classes = ALL_CLASS_OPTIONS.filter((c) => selectedClassIds.includes(c.id)).map(
          (c) => ({
            section: c.section,
            name: c.name,
            stream: undefined as string | undefined,
            level_order: c.level,
          }),
        );
        const subjects = DEFAULT_SUBJECTS.filter((s) => selectedSubjects.includes(s.name)).map(
          (s) => ({ name: s.name, code: s.code }),
        );
        if (subjects.length < 1) {
          toast.error("Select at least one subject");
          setBusy(false);
          return;
        }
        await saveWizardAcademics({ data: { schoolId: school.id, classes, subjects } });
        await markDone("academics_done");
        toast.success(`${classes.length} class(es) and ${subjects.length} subject(s) saved`);
      } else if (current.key === "grading") {
        await markDone("grading_done");
        toast.success("Grading step confirmed");
      } else if (current.key === "fees") {
        await markDone("fees_done");
        toast.success("Fees step confirmed — configure amounts under Finance");
      } else if (current.key === "behaviour") {
        await markDone("behaviour_done");
        toast.success("Behaviour step confirmed");
      } else if (current.key === "parent_app") {
        const pub = await publishParentApp({
          data: {
            schoolId: school.id,
            appName: appName || `${school.name} Parent`,
            primaryColor,
            logoMark,
          },
        });
        await markDone("parent_app_done");
        toast.success(`Parent app published: ${pub.installUrl || "/p/" + school.slug}`);
      }

      await invalidate();

      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        toast.success("Setup complete — welcome to your school desk");
        navigate({ to: "/app" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const doneCount = STEPS.filter((s) => progress[s.progressKey]).length;

  return (
    <div>
      <PageHeader
        kicker="Onboarding"
        title="School setup wizard"
        description="Configure the essentials so staff and parents can start using NEXUS."
        actions={
          <Link to="/app/settings">
            <Button variant="outline">Open full settings</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === step
                ? "bg-primary text-primary-foreground"
                : progress[s.progressKey]
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {i + 1}. {s.title}
            {progress[s.progressKey] ? " ✓" : ""}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Progress: {doneCount} / {STEPS.length} steps
      </p>

      <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">{current.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{current.blurb}</p>

        {current.key === "profile" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Motto</Label>
              <Input value={motto} onChange={(e) => setMotto(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        )}

        {current.key === "branding" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Logo mark (1–3 letters)</Label>
              <Input
                value={logoMark}
                onChange={(e) => setLogoMark(e.target.value.slice(0, 3))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Primary colour</Label>
              <Input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Parent app name</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
            </div>
          </div>
        )}

        {current.key === "academics" && (
          <div className="mt-4 space-y-6">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Primary classes (select all that apply)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedClassIds((prev) => {
                      const ids = PRIMARY_CLASSES.map((c) => c.id);
                      const allOn = ids.every((id) => prev.includes(id));
                      return allOn
                        ? prev.filter((id) => !ids.includes(id as typeof ids[number]))
                        : [...new Set([...prev, ...ids])];
                    })
                  }
                >
                  Toggle all primary
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRIMARY_CLASSES.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Secondary classes (select all that apply)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedClassIds((prev) => {
                      const ids = SECONDARY_CLASSES.map((c) => c.id);
                      const allOn = ids.every((id) => prev.includes(id));
                      return allOn
                        ? prev.filter((id) => !ids.includes(id as typeof ids[number]))
                        : [...new Set([...prev, ...ids])];
                    })
                  }
                >
                  Toggle all secondary
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECONDARY_CLASSES.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedClassIds.length} class(es). At least one is required.
            </p>
            <div>
              <Label>Subjects (select at least one)</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {DEFAULT_SUBJECTS.map((s) => (
                  <label
                    key={s.code}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(s.name)}
                      onChange={() => toggleSubject(s.name)}
                    />
                    {s.name} ({s.code})
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {current.key === "grading" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Default scale uses percentage bands (A–F). Fine-tune weighting later under Academics /
            Results. Confirm to continue.
          </p>
        )}

        {current.key === "fees" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Create detailed fee structures under Finance. This step marks that you have reviewed fee
            setup for the term.
          </p>
        )}

        {current.key === "behaviour" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Positive and negative categories can be extended under Behaviour. Confirm defaults are
            acceptable for launch.
          </p>
        )}

        {current.key === "parent_app" && (
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>
              Publishing generates the school-locked parent portal at{" "}
              <code>/p/{school.parent_app_slug || school.slug}</code>.
            </p>
            <p>After Finish you will leave the wizard and can share that link on WhatsApp.</p>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button onClick={() => void handleNext()} disabled={busy}>
            {busy ? "Saving…" : step === STEPS.length - 1 ? "Finish" : "Save & continue"}
          </Button>
        </div>
      </section>
    </div>
  );
}
