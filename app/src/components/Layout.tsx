import type { ReactNode } from "react";
import { useTheme } from "../lib/useTheme";
import styles from "./Layout.module.css";

type View =
  | "leaderboard"
  | "timeline"
  | "genres"
  | "genreTimeline"
  | "replay"
  | "shared"
  | "compare";

interface LayoutProps {
  people: string[];
  activePerson: string;
  onPersonChange: (person: string) => void;
  view: View;
  onViewChange: (view: View) => void;
  children: ReactNode;
}

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "timeline", label: "Timeline" },
  { id: "genres", label: "Genres" },
  { id: "genreTimeline", label: "Genre Timeline" },
  { id: "replay", label: "Replay" },
  { id: "shared", label: "Shared" },
  { id: "compare", label: "Compare" },
];

export function Layout({
  people,
  activePerson,
  onPersonChange,
  view,
  onViewChange,
  children,
}: LayoutProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>top25tracker</h1>
          <p className={styles.subtitle}>monthly favorites, tracked</p>
        </div>

        <nav className={styles.tabs} aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.tab}
              data-active={v.id === view}
              onClick={() => onViewChange(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <div className={styles.controls}>
          <div className={styles.personSwitch} role="tablist" aria-label="Person">
            {people.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === activePerson}
                className={styles.personButton}
                data-active={p === activePerson}
                onClick={() => onPersonChange(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.themeButton}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
