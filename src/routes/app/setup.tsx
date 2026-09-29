import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
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
  saveWizardGrading,
  updateSchool,
  updateSetupProgress,
  uploadSchoolFile,
} from "@/lib/nexus/server";
import {
  MANEB_POINTS_BANDS,
  PRIMARY_LETTER_BANDS,
  SECONDARY_JUNIOR_LETTER_BANDS,
} from "@/lib/nexus/grading-templates";
import { extractColorsFromImageDataUrl } from "@/lib/nexus/logo-colors";


export const Route = createFileRoute("/app/setup")({
  component: SetupWizardPage,
  validateSearch: (search: Record<string, unknown>) => ({
    step: typeof search.step === "string" ? search.step : undefined,
    feesConfigured: search.feesConfigured === "1" || search.feesConfigured === true,
    behaviourConfigured:
      search.behaviourConfigured === "1" || search.behaviourConfigured === true,
  }),
});


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
  { key: "branding", progressKey: "branding_done", title: "Branding", blurb: "Logo, colours for parent app" },
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


type BandEdit = {
  grade: string;
  min: number;
  max: number;
  points?: number | null;
  remark?: string;
};

type ScaleEdit = {
  name: string;
  section?: string;
  system: "letter" | "points_1_9" | "custom";
  appliesTo?: string;
  continuousWeight?: number;
  examWeight?: number;
  isDefault?: boolean;
  bands: BandEdit[];
};

/** Starting templates — school edits every band. MANEB-style 1–9 for secondary. */
function defaultGradingScalesTemplate(): ScaleEdit[] {
  return [
    {
      name: "Primary (letters A–F)",
      section: "Primary",
      system: "letter",
      appliesTo: "Primary classes",
      isDefault: true,
      continuousWeight: 40,
      examWeight: 60,
      bands: PRIMARY_LETTER_BANDS.map((b) => ({ ...b })),
    },
    {
      name: "Nursery",
      section: "Nursery",
      system: "custom",
      appliesTo: "Nursery classes",
      bands: [],
    },
    {
      name: "Secondary Form 1–2 (letters A–F)",
      section: "Secondary",
      system: "letter",
      appliesTo: "Form 1 and Form 2",
      bands: SECONDARY_JUNIOR_LETTER_BANDS.map((b) => ({ ...b })),
    },
    {
      name: "Secondary Form 3–4 (MANEB-style points 1–9)",
      section: "Secondary",
      system: "points_1_9",
      appliesTo: "Form 3 and Form 4 (MSCE-oriented)",
      bands: MANEB_POINTS_BANDS.map((b) => ({ ...b })),
    },
  ];
}

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
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [secondaryColor, setSecondaryColor] = useState("#134e4a");
  const [appName, setAppName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [nurseryClasses, setNurseryClasses] = useState<string[]>(["Baby class", "Reception"]);
  const [nurseryDraft, setNurseryDraft] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<
    { name: string; code: string; section: string; classNames: string[] }[]
  >([
    { name: "Mathematics", code: "MATH", section: "Primary", classNames: [] },
    { name: "English", code: "ENG", section: "Primary", classNames: [] },
    { name: "Science", code: "SCI", section: "Primary", classNames: [] },
    { name: "Mathematics", code: "MATH", section: "Secondary", classNames: [] },
    { name: "English", code: "ENG", section: "Secondary", classNames: [] },
    { name: "Play / Activity", code: "PLAY", section: "Nursery", classNames: [] },
  ]);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [customSubjectSection, setCustomSubjectSection] = useState("Primary");
  const [customSubjectClasses, setCustomSubjectClasses] = useState<string[]>([]);

  useEffect(() => {
    if (!school) return;
    setMotto(school.motto ?? "");
    setPhone(school.phone ?? "");
    setEmail(school.email ?? "");
    setLogoMark(school.logo_mark ?? school.name.slice(0, 2).toUpperCase());
    setLogoUrl((school as { logo_url?: string }).logo_url ?? "");
    setLogoPreview((school as { logo_url?: string }).logo_url ?? null);
    setPrimaryColor(school.primary_color ?? "#0f766e");
    setSecondaryColor(school.secondary_color ?? "#134e4a");
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
            secondaryColor,
            logoMark,
            logoUrl: logoUrl || undefined,
          },
        });
        await markDone("branding_done");
        toast.success("Branding saved");
      } else if (current.key === "academics") {
        const primarySecondary = ALL_CLASS_OPTIONS.filter((c) =>
          selectedClassIds.includes(c.id),
        ).map((c) => ({
          section: c.section,
          name: c.name,
          stream: undefined as string | undefined,
          level_order: c.level,
        }));
        const nursery = nurseryClasses
          .map((n) => n.trim())
          .filter(Boolean)
          .map((name, i) => ({
            section: "Nursery",
            name,
            stream: undefined as string | undefined,
            level_order: i + 1,
          }));
        const classes = [...nursery, ...primarySecondary];
        if (classes.length < 1) {
          toast.error("Add at least one class (Nursery, Primary, or Secondary)");
          setBusy(false);
          return;
        }
        const subjects = selectedSubjects.map((s) => ({
          name: s.name,
          code: s.code,
          section: s.section,
          classNames: s.classNames || [],
        }));
        if (subjects.length < 1) {
          toast.error("Add at least one subject");
          setBusy(false);
          return;
        }
        await saveWizardAcademics({ data: { schoolId: school.id, classes, subjects } });
        await markDone("academics_done");
        toast.success(`${classes.length} class(es) and ${subjects.length} subject(s) saved`);
      } else if (current.key === "grading") {
        await saveWizardGrading({
          data: {
            schoolId: school.id,
            scales: gradingScales,
          },
        });
        await markDone("grading_done");
        toast.success("Grading scales saved — edit anytime under Academics");
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
            secondaryColor,
            logoMark,
            logoUrl: logoUrl || undefined,
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
          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <Label>School logo</Label>
              <p className="text-xs text-muted-foreground">
                Upload your crest or logo for the parent app icon and headers. We suggest brand
                colours from the image — you can change them.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="size-full object-contain" />
                  ) : (
                    <span className="font-display text-2xl font-semibold" style={{ color: primaryColor }}>
                      {logoMark || "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={uploadingLogo}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !school) return;
                      if (file.size > 2.5 * 1024 * 1024) {
                        toast.error("Logo must be under 2.5 MB");
                        return;
                      }
                      setUploadingLogo(true);
                      try {
                        const reader = new FileReader();
                        const dataUrl: string = await new Promise((resolve, reject) => {
                          reader.onload = () => resolve(String(reader.result));
                          reader.onerror = () => reject(new Error("Read failed"));
                          reader.readAsDataURL(file);
                        });
                        setLogoPreview(dataUrl);
                        try {
                          const colors = await extractColorsFromImageDataUrl(dataUrl);
                          setSuggestedColors(colors);
                          if (colors[0]) setPrimaryColor(colors[0]);
                          if (colors[1]) setSecondaryColor(colors[1]);
                          else if (colors[0]) setSecondaryColor(colors[0]);
                          toast.message("Colours suggested from logo — adjust if needed");
                        } catch {
                          /* colour extract optional */
                        }
                        try {
                          const uploaded = await uploadSchoolFile({
                            data: {
                              schoolId: school.id,
                              purpose: "logo",
                              dataBase64: dataUrl,
                              filename: file.name,
                              mimeType: file.type,
                            },
                          });
                          setLogoUrl(uploaded.url);
                          setLogoPreview(uploaded.url);
                        } catch (uploadErr) {
                          // Keep local preview; still usable for colour suggestions offline
                          toast.message(
                            uploadErr instanceof Error
                              ? `${uploadErr.message} — colours still applied from preview`
                              : "Upload deferred; colours applied from preview",
                          );
                        }
                        if (!logoMark) {
                          setLogoMark(school.name.slice(0, 2).toUpperCase());
                        }
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not read logo");
                      } finally {
                        setUploadingLogo(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    PNG, JPG or WebP · max 2.5 MB
                    {uploadingLogo ? " · Uploading…" : ""}
                  </p>
                </div>
              </div>
            </div>

            {suggestedColors.length > 0 && (
              <div className="space-y-2">
                <Label>Suggested colours from logo</Label>
                <div className="flex flex-wrap gap-2">
                  {suggestedColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={`Use ${c}`}
                      className="flex flex-col items-center gap-1 rounded-md border border-border p-1.5 text-[10px] hover:bg-secondary"
                      onClick={() => {
                        setPrimaryColor(c);
                        toast.success(`Primary set to ${c}`);
                      }}
                      onContextMenu={(ev) => {
                        ev.preventDefault();
                        setSecondaryColor(c);
                        toast.success(`Secondary set to ${c}`);
                      }}
                    >
                      <span
                        className="size-9 rounded-md border border-border shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                      <span className="font-mono">{c}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tap a swatch for primary colour · long-press / right-click for secondary
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Primary colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Secondary colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Logo mark (1–3 letters, fallback if no image)</Label>
                <Input
                  value={logoMark}
                  onChange={(e) => setLogoMark(e.target.value.slice(0, 3))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Parent app name</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
              </div>
            </div>

            <div
              className="rounded-xl border border-border p-4"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}22, ${secondaryColor}33)`,
              }}
            >
              <p className="text-xs font-medium text-muted-foreground">Parent app preview</p>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="flex size-12 items-center justify-center overflow-hidden rounded-xl text-white shadow"
                  style={{ backgroundColor: primaryColor }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="size-full object-contain" />
                  ) : (
                    <span className="text-lg font-bold">{logoMark || "N"}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium" style={{ color: primaryColor }}>
                    {appName || `${school?.name || "School"} Parent`}
                  </p>
                  <p className="text-xs text-muted-foreground">Branded parent experience</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {current.key === "academics" && (
          <div className="mt-4 space-y-8">
            <div>
              <h3 className="font-medium">Nursery classes (add your own)</h3>
              <p className="text-xs text-muted-foreground">
                e.g. Baby class, Reception, Middle class — names are up to the school.
              </p>
              <ul className="mt-2 space-y-1">
                {nurseryClasses.map((n, i) => (
                  <li key={`${n}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 rounded-md border border-border px-3 py-1.5">{n}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setNurseryClasses((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="New nursery class name"
                  value={nurseryDraft}
                  onChange={(e) => setNurseryDraft(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const v = nurseryDraft.trim();
                    if (!v) return;
                    setNurseryClasses((prev) => [...prev, v]);
                    setNurseryDraft("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Primary (Standard 1–8)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedClassIds((prev) => {
                      const ids = PRIMARY_CLASSES.map((c) => c.id);
                      const allOn = ids.every((id) => prev.includes(id));
                      return allOn
                        ? prev.filter((id) => !ids.includes(id as (typeof ids)[number]))
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
                <Label>Secondary (Form 1–6)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedClassIds((prev) => {
                      const ids = SECONDARY_CLASSES.map((c) => c.id);
                      const allOn = ids.every((id) => prev.includes(id));
                      return allOn
                        ? prev.filter((id) => !ids.includes(id as (typeof ids)[number]))
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

            <div>
              <Label>Subjects by section (defaults can be removed; add as many as you offer)</Label>
              <ul className="mt-2 space-y-1">
                {selectedSubjects.map((s, i) => (
                  <li
                    key={`${s.section}-${s.name}-${i}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">{s.section}</span>
                    <span className="flex-1">
                      {s.name} {s.code ? `(${s.code})` : ""}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {s.classNames?.length
                          ? `Classes: ${s.classNames.join(", ")}`
                          : "All classes in section"}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelectedSubjects((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Subject name"
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                />
                <Input
                  placeholder="Code"
                  value={customSubjectCode}
                  onChange={(e) => setCustomSubjectCode(e.target.value)}
                />
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={customSubjectSection}
                  onChange={(e) => setCustomSubjectSection(e.target.value)}
                >
                  <option value="Nursery">Nursery</option>
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                </select>

              <div className="sm:col-span-4 space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Classes this subject is taught in (optional — leave empty for all in section)
                </p>
                <div className="flex flex-wrap gap-2">
                  {(customSubjectSection === "Nursery"
                    ? nurseryClasses
                    : customSubjectSection === "Primary"
                      ? PRIMARY_CLASSES.map((c) => c.name)
                      : SECONDARY_CLASSES.map((c) => c.name)
                  ).map((cn) => (
                    <label
                      key={cn}
                      className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={customSubjectClasses.includes(cn)}
                        onChange={() =>
                          setCustomSubjectClasses((prev) =>
                            prev.includes(cn)
                              ? prev.filter((x) => x !== cn)
                              : [...prev, cn],
                          )
                        }
                      />
                      {cn}
                    </label>
                  ))}
                </div>
              </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const name = customSubjectName.trim();
                    if (!name) return;
                    setSelectedSubjects((prev) => [
                      ...prev,
                      {
                        name,
                        code: customSubjectCode.trim() || name.slice(0, 4).toUpperCase(),
                        section: customSubjectSection,
                        classNames: [...customSubjectClasses],
                      },
                    ]);
                    setCustomSubjectName("");
                    setCustomSubjectCode("");
                    setCustomSubjectClasses([]);
                  }}
                >
                  Add subject
                </Button>
              </div>
            </div>
          </div>
        )}

        {current.key === "grading" && (
          <div className="mt-4 space-y-6">
            <p className="text-sm text-muted-foreground">
              Each school defines its own scales. Starters:{" "}
              <strong>Primary and Form 1–2 use letters A–F; Nursery starts blank</strong>;{" "}
              <strong>Form 3–4</strong> starts from a MANEB-style <strong>points 1–9</strong> map
              (1 best, 9 fail). All bands are examples only — edit everything to match your school.
            </p>
            {gradingScales.map((scale, si) => (
              <div
                key={scale.name + si}
                className="rounded-xl border border-border p-4 space-y-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Scale name</Label>
                    <Input
                      value={scale.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGradingScales((prev) =>
                          prev.map((x, i) => (i === si ? { ...x, name: v } : x)),
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Applies to</Label>
                    <Input
                      value={scale.appliesTo || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGradingScales((prev) =>
                          prev.map((x, i) => (i === si ? { ...x, appliesTo: v } : x)),
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2">Grade / point</th>
                        <th className="py-1 pr-2">Min %</th>
                        <th className="py-1 pr-2">Max %</th>
                        <th className="py-1 pr-2">Points</th>
                        <th className="py-1">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scale.bands.map((b, bi) => (
                        <tr key={bi} className="border-t border-border">
                          <td className="py-1 pr-2">
                            <Input
                              className="h-8"
                              value={b.grade}
                              onChange={(e) => {
                                const v = e.target.value;
                                setGradingScales((prev) =>
                                  prev.map((x, i) =>
                                    i !== si
                                      ? x
                                      : {
                                          ...x,
                                          bands: x.bands.map((bb, j) =>
                                            j === bi ? { ...bb, grade: v } : bb,
                                          ),
                                        },
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              className="h-8"
                              type="number"
                              value={b.min}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setGradingScales((prev) =>
                                  prev.map((x, i) =>
                                    i !== si
                                      ? x
                                      : {
                                          ...x,
                                          bands: x.bands.map((bb, j) =>
                                            j === bi ? { ...bb, min: v } : bb,
                                          ),
                                        },
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              className="h-8"
                              type="number"
                              value={b.max}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setGradingScales((prev) =>
                                  prev.map((x, i) =>
                                    i !== si
                                      ? x
                                      : {
                                          ...x,
                                          bands: x.bands.map((bb, j) =>
                                            j === bi ? { ...bb, max: v } : bb,
                                          ),
                                        },
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              className="h-8"
                              type="number"
                              value={b.points ?? ""}
                              onChange={(e) => {
                                const v =
                                  e.target.value === "" ? null : Number(e.target.value);
                                setGradingScales((prev) =>
                                  prev.map((x, i) =>
                                    i !== si
                                      ? x
                                      : {
                                          ...x,
                                          bands: x.bands.map((bb, j) =>
                                            j === bi ? { ...bb, points: v } : bb,
                                          ),
                                        },
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="py-1">
                            <Input
                              className="h-8"
                              value={b.remark || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setGradingScales((prev) =>
                                  prev.map((x, i) =>
                                    i !== si
                                      ? x
                                      : {
                                          ...x,
                                          bands: x.bands.map((bb, j) =>
                                            j === bi ? { ...bb, remark: v } : bb,
                                          ),
                                        },
                                  ),
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {scale.bands.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No default bands — add your own nursery grades if you use them.
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGradingScales((prev) =>
                      prev.map((x, i) =>
                        i !== si
                          ? x
                          : {
                              ...x,
                              bands: [
                                ...x.bands,
                                { grade: "", min: 0, max: 100, points: null, remark: "" },
                              ],
                            },
                      ),
                    );
                  }}
                >
                  Add band
                </Button>
              </div>
            ))}
          </div>
        )}


        {current.key === "fees" && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Open Finance to create fee structures (you can assign one amount to many classes at
              once). When you save there, you return here to continue the wizard.
            </p>
            {search?.feesConfigured ? (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-200">
                Fee setup visited — click Save & continue when you are ready.
              </p>
            ) : null}
            <Button asChild variant="secondary">
              <Link to="/app/finance" search={{ from: "setup" } as any}>
                Set fees in Finance
              </Link>
            </Button>
          </div>
        )}

        {current.key === "behaviour" && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Open Behaviour to review categories and how incidents are logged. After you save or
              review there, you return here to continue.
            </p>
            {search?.behaviourConfigured ? (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-200">
                Behaviour page visited — click Save & continue when you are ready.
              </p>
            ) : null}
            <Button asChild variant="secondary">
              <Link to="/app/behaviour" search={{ from: "setup" } as any}>
                Set behaviour rules
              </Link>
            </Button>
          </div>
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
