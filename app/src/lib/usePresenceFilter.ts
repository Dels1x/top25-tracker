import { useMemo } from "react";
import type { PresenceRequirement } from "./stats";
import { usePersistedState } from "./usePersistedState";

/**
 * Per-person required/any/excluded state behind the Shared tab's 3 presence
 * buttons - persisted as a plain `{ [person]: PresenceRequirement }` record
 * (not a Set, since there's a 3-way state per person rather than a yes/no
 * membership) via the same localStorage-backed usePersistedState every other
 * UI preference in this app uses. Defaults to "required" for everyone, i.e.
 * the original "shared by everyone" behavior, so loading the tab fresh looks
 * exactly like it always has.
 */
export function usePresenceFilter(people: string[]) {
  const [record, setRecord] = usePersistedState<Record<string, PresenceRequirement>>(
    "sharedPresenceFilter",
    Object.fromEntries(people.map((p) => [p, "required" as PresenceRequirement]))
  );

  function cycle(person: string) {
    setRecord((prev) => {
      const current = prev[person] ?? "required";
      const next: PresenceRequirement =
        current === "required" ? "any" : current === "any" ? "excluded" : "required";
      return { ...prev, [person]: next };
    });
  }

  function setRequirement(person: string, requirement: PresenceRequirement) {
    setRecord((prev) => ({ ...prev, [person]: requirement }));
  }

  // A person missing from the stored record (e.g. added after this was first
  // persisted) defaults to "required" too, matching the initial default.
  const requirementFor = (person: string): PresenceRequirement => record[person] ?? "required";

  const presenceMap = useMemo(
    () => new Map(people.map((p) => [p, requirementFor(p)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, record]
  );

  return { requirementFor, cycle, setRequirement, presenceMap };
}
