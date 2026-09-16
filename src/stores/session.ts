import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Persona } from "@/lib/nexus/types";

export type { Persona };

type SessionState = {
  /**
   * Staff UI variant for school users (not a security boundary).
   * Platform owner is detected via isPlatformOwner on the snapshot, not this field.
   * Default "owner" = full school staff menus.
   */
  persona: Persona;
  schoolSlug: string;
  setPersona: (p: Persona) => void;
  setSchoolSlug: (s: string) => void;
};

export const useNexusSession = create<SessionState>()(
  persist(
    (set) => ({
      persona: "owner",
      schoolSlug: "",
      setPersona: (persona) => set({ persona }),
      setSchoolSlug: (schoolSlug) => set({ schoolSlug }),
    }),
    { name: "nexus-session" },
  ),
);

/** Demo role-tour list removed. */
export const PERSONAS: { id: Persona; label: string; blurb: string }[] = [];
