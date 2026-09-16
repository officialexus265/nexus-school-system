import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { submitAdmission } from "@/lib/nexus/server";

export const Route = createFileRoute("/apply/$slug")({ component: ApplyPage });

function ApplyPage() {
  const { slug } = Route.useParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    applicantName: "",
    dateOfBirth: "",
    gender: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    applyingClass: "",
    previousSchool: "",
    notes: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitAdmission({
        data: {
          slug,
          applicantName: form.applicantName,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          guardianName: form.guardianName,
          guardianPhone: form.guardianPhone,
          guardianEmail: form.guardianEmail || undefined,
          applyingClass: form.applyingClass || undefined,
          previousSchool: form.previousSchool || undefined,
          notes: form.notes || undefined,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink px-4 text-foam">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl">Application received</h1>
          <p className="mt-2 text-sm text-mist">
            The school will contact the guardian on the phone number you provided.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-ink px-4 py-12 text-foam">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl">Online admission</h1>
        <p className="mt-1 text-sm text-mist">Apply to join this school.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field
            label="Applicant full name"
            value={form.applicantName}
            onChange={(v) => setForm((f) => ({ ...f, applicantName: v }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))}
            />
            <div>
              <label className="text-xs text-mist">Gender</label>
              <select
                className="mt-1 w-full rounded-lg border border-foam/20 bg-ink-2 px-3 py-2 text-sm"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">—</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>
          <Field
            label="Guardian name"
            value={form.guardianName}
            onChange={(v) => setForm((f) => ({ ...f, guardianName: v }))}
            required
          />
          <Field
            label="Guardian phone"
            value={form.guardianPhone}
            onChange={(v) => setForm((f) => ({ ...f, guardianPhone: v }))}
            required
          />
          <Field
            label="Guardian email"
            value={form.guardianEmail}
            onChange={(v) => setForm((f) => ({ ...f, guardianEmail: v }))}
          />
          <Field
            label="Class applying for"
            value={form.applyingClass}
            onChange={(v) => setForm((f) => ({ ...f, applyingClass: v }))}
            placeholder="e.g. Form 1"
          />
          <Field
            label="Previous school"
            value={form.previousSchool}
            onChange={(v) => setForm((f) => ({ ...f, previousSchool: v }))}
          />
          <div>
            <label className="text-xs text-mist">Notes</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-foam/20 bg-ink-2 px-3 py-2 text-sm"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-mist">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-foam/20 bg-ink-2 px-3 py-2 text-sm"
      />
    </div>
  );
}
