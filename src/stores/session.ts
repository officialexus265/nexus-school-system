import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Persona } from "@/lib/nexus/types";

export type { Persona };

type SessionState = {
  persona: Persona;
  schoolSlug: string;
  setPersona: (p: Persona) => void;
  setSchoolSlug: (s: string) => void;
};

export const PERSONAS: { id: Persona; label: string; blurb: string }[] = [
  { id: "owner", label: "School owner", blurb: "Full authority inside the school" },
  { id: "head", label: "Head teacher", blurb: "Academic oversight and result approval" },
  { id: "teacher", label: "Teacher", blurb: "Classes and marks" },
  { id: "exam", label: "Examination officer", blurb: "Marks, ranking and publication" },
  { id: "bursar", label: "Bursar", blurb: "Fees, receipts and outstanding balances" },
  { id: "parent", label: "Parent", blurb: "Linked children only" },
  { id: "platform", label: "Platform owner", blurb: "Schools, billing and activation" },
];

export const useNexusSession = create<SessionState>()(
  persist(
    (set) => ({
      persona: "owner",
      schoolSlug: "sunrise",
      setPersona: (persona) => set({ persona }),
      setSchoolSlug: (schoolSlug) => set({ schoolSlug }),
    }),
    { name: "nexus-session" },
  ),
);
