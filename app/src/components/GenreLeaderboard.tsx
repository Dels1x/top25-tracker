import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { genreTotals, sortedMonths, tracksForGenre, type StatsOptions } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { useMonthRange } from "../lib/useMonthRange";
import { RangePicker } from "./RangePicker";
import styles from "./Leaderboard.module.css";

interface GenreLeaderboardProps {
  dataset: Dataset;
  person: string;
  scoringOptions: StatsOptions;
}

type SongSortKey = "date" | "rank" | "title" | "album";
type SortDirection = "asc" | "desc";

const SONG_SORT_COLUMNS: Array<{ key: SongSortKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "rank", label: "#" },
  { key: "title", label: "Song" },
  { key: "album", label: "Album" },
];

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Same shape as Leaderboard, but ranking major genres instead of artists -
 * reuses Leaderboard.module.css since the list/row/expandable-panel layout
 * is identical. No pagination needed: there are only ~19 genre/subgenre
 * buckets total (see src/lib/artistGenres.ts), unlike the potentially
 * hundreds of artists Leaderboard has to page through.
 */
export function GenreLeaderboard({ dataset, person, scoringOptions }: GenreLeaderboardProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SongSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const availableMonths = useMemo(() => sortedMonths(dataset, person), [dataset, person]);
  const { startIndex, endIndex, lastIndex, rangeOptions, handleSliderChange, applyPreset } =
    useMonthRange(availableMonths, `genre-leaderboard:${person}`);

  // Only includeDuplicates/startMonth/endMonth are meaningful for genres -
  // the artist-identity options (unite/producers/duos) don't apply.
  const genreOptions: StatsOptions = {
    includeDuplicates: scoringOptions.includeDuplicates,
    ...rangeOptions,
  };

  const totals = useMemo(
    () => genreTotals(dataset, person, genreOptions),
    [dataset, person, genreOptions]
  );
  const colorMap = useMemo(() => buildArtistColorMap(totals.map((t) => t.genre)), [totals]);
  const max = totals[0]?.total ?? 1;

  const isExpandedStillPresent = useMemo(
    () => expanded !== null && totals.some((t) => t.genre === expanded),
    [expanded, totals]
  );
  const activeExpanded = isExpandedStillPresent ? expanded : null;

  const expandedTracks = useMemo(() => {
    if (!activeExpanded) return [];
    const tracks = tracksForGenre(dataset, activeExpanded, person, genreOptions);
    return [...tracks].sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case "date":
          cmp = a.month.localeCompare(b.month);
          break;
        case "rank":
          cmp = a.rank - b.rank;
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "album":
          cmp = a.album.localeCompare(b.album);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [dataset, activeExpanded, person, genreOptions, sortKey, sortDir]);

  function toggle(genre: string) {
    setExpanded((prev) => (prev === genre ? null : genre));
  }

  function handleSort(key: SongSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "rank" ? "desc" : "asc");
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Songs per genre</h2>
        <p className={styles.sub}>
          A song counts toward every major genre its Spotify tags touch (so a "rap metal" track
          adds to both Hip-Hop and Metal){scoringOptions.includeDuplicates === false &&
            " · repeat songs counted once"} &middot; click a genre to see its songs
        </p>
      </div>

      <RangePicker
        months={availableMonths}
        startIndex={startIndex}
        endIndex={endIndex}
        lastIndex={lastIndex}
        onSliderChange={handleSliderChange}
        onPreset={applyPreset}
      />

      <ol className={styles.list}>
        {totals.map((row, index) => {
          const pct = (row.total / max) * 100;
          const color = colorMap.get(row.genre) ?? "var(--text-muted)";
          const isOpen = activeExpanded === row.genre;
          return (
            <li key={row.genre} className={styles.item}>
              <button
                type="button"
                className={styles.row}
                onClick={() => toggle(row.genre)}
                aria-expanded={isOpen}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.name} title={row.genre}>
                  {row.genre}
                </span>
                <div className={styles.barTrack}>
                  <motion.div
                    className={styles.bar}
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.015 }}
                  />
                </div>
                <span className={styles.value}>{row.total}</span>
                <span className={styles.chevron} data-open={isOpen} aria-hidden="true">
                  ▾
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className={styles.panelWrap}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className={styles.songHeaderRow}>
                      {SONG_SORT_COLUMNS.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          className={
                            col.key === "album"
                              ? `${styles.songHeaderButton} ${styles.hideOnMobile}`
                              : styles.songHeaderButton
                          }
                          onClick={() => handleSort(col.key)}
                          data-active={sortKey === col.key}
                        >
                          {col.label}
                          {sortKey === col.key && (
                            <span className={styles.sortArrow} aria-hidden="true">
                              {sortDir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </button>
                      ))}
                      <span className={styles.songHeaderStatic}>Artist(s)</span>
                    </div>
                    <ul className={styles.songList}>
                      {expandedTracks.map((track, i) => (
                        <li key={`${track.month}-${track.rank}-${i}`} className={styles.songRow}>
                          <span className={styles.songMonth}>{formatMonth(track.month)}</span>
                          <span className={styles.songRank}>#{track.rank}</span>
                          <span className={styles.songTitle} title={track.title}>
                            {track.title}
                          </span>
                          <span className={styles.songAlbum} title={track.album}>
                            {track.album}
                          </span>
                          <span className={styles.songArtists} title={track.creditedArtists.join(", ")}>
                            {track.creditedArtists.join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
