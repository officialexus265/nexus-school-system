import { createFileRoute, Link } from "@tanstack/react-router";
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
  { key: "academics", progressKey: "academics_done", title: "Academics", blurb: "Classes and subjects" },
  { key: "grading", progressKey: "grading_done", title: "Grading", blurb: "Confirm grading approach" },
  { key: "fees", progressKey: "fees_done", title: "Fees", blurb: "Confirm fee structures exist" },
  { key: "behaviour", progressKey: "behaviour_done", title: "Behaviour", blurb: "Discipline categories ready" },
  { key: "parent_app", progressKey: "parent_app_done", title: "Parent app", blurb: "Publish branded parent portal" },
];

function SetupWizardPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const school = q.data?.school;
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // Profile
  const [motto, setMotto] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Branding
  const [logoMark, setLogoMark] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [appName, setAppName] = useState("");

  // Academics
  const [classLines, setClassLines] = useState("Secondary, Form 1, A\nSecondary, Form 2, A\nPrimary, Standard 5");
  const [subjectLines, setSubjectLines] = useState("Mathematics, MATH\nEnglish, ENG\nScience, SCI");

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
      })
      .catch(() => {});
  }, [school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!school) return null;

  const current = STEPS[step];

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
        const classes = classLines
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [section, name, stream] = l.split(",").map((x) => x.trim());
            return { section: section || "General", name: name || section, stream };
          });
        const subjects = subjectLines
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [name, code, section] = l.split(",").map((x) => x.trim());
            return { name, code, section };
          });
        await saveWizardAcademics({ data: { schoolId: school.id, classes, subjects } });
        toast.success("Classes and subjects added");
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
        toast.success(`Parent app published: ${pub.installUrl}`);
      }
      await invalidate();
      if (step < STEPS.length - 1) setStep((s) => s + 1);
      else toast.success("Setup complete");
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
              <Label>Parent app name</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Logo mark</Label>
              <Input
                value={logoMark}
                maxLength={3}
                onChange={(e) => setLogoMark(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Primary colour</Label>
              <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
          </div>
        )}

        {current.key === "academics" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Classes (one per line: Section, Name, Stream)</Label>
              <textarea
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={classLines}
                onChange={(e) => setClassLines(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subjects (one per line: Name, Code)</Label>
              <textarea
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={subjectLines}
                onChange={(e) => setSubjectLines(e.target.value)}
              />
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
            <p>Share that link on WhatsApp after this step.</p>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button onClick={handleNext} disabled={busy}>
            {busy ? "Saving…" : step === STEPS.length - 1 ? "Finish" : "Save & continue"}
          </Button>
        </div>
      </section>
    </div>
  );
}
