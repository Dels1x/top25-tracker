import type { PresenceRequirement } from "../lib/stats";
import styles from "./PresenceFilter.module.css";

interface PresenceFilterProps {
  people: string[];
  requirementFor: (person: string) => PresenceRequirement;
  onCycle: (person: string) => void;
}

const LABEL: Record<PresenceRequirement, string> = {
  required: "In",
  any: "Any",
  excluded: "Not in",
};

const DESCRIPTION: Record<PresenceRequirement, string> = {
  required: "must have been in this person's top 25 at some point",
  any: "doesn't matter whether this person had it",
  excluded: "must never have been in this person's top 25",
};

/**
 * One 3-state cycle button per person for the Shared tab: each button cycles
 * required -> any -> excluded -> required on click, controlling whether a
 * song must have appeared in that person's top 25, must never have, or it
 * doesn't matter which. With every button on "any", this reduces to "every
 * song anyone has ever had in a top 25" rather than the narrower "shared by
 * everyone" default (every button starts on "required").
 *
 * A single button per person (rather than 3 separate buttons/a dropdown) was
 * chosen to match RankFilter/ModeSwitch's existing segmented-control visual
 * language elsewhere in the app, while still fitting 3 people's worth of
 * controls in one compact row.
 */
export function PresenceFilter({ people, requirementFor, onCycle }: PresenceFilterProps) {
  return (
    <div className={styles.row} role="group" aria-label="Filter by who had each song">
      {people.map((person) => {
        const requirement = requirementFor(person);
        return (
          <button
            key={person}
            type="button"
            className={styles.button}
            data-state={requirement}
            onClick={() => onCycle(person)}
            title={`${person}: ${DESCRIPTION[requirement]} (click to change)`}
          >
            <span className={styles.person}>{person}</span>
            <span className={styles.state}>{LABEL[requirement]}</span>
          </button>
        );
      })}
    </div>
  );
}
