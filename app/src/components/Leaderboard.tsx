import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import { artistTotals, sortedMonths, tracksForArtist, type StatsOptions } from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { useMonthRange } from "../lib/useMonthRange";
import { useGenreFilter } from "../lib/useGenreFilter";
import { useRankFilter } from "../lib/useRankFilter";
import { RangePicker } from "./RangePicker";
import { GenreFilter } from "./GenreFilter";
import { RankFilter } from "./RankFilter";
import { StatsRow } from "./StatsRow";
import styles from "./Leaderboard.module.css";

interface LeaderboardProps {
  dataset: Dataset;
  person: string;
  scoringOptions: StatsOptions;
}

const PAGE_SIZE = 20;

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

export function Leaderboard({ dataset, person, scoringOptions }: LeaderboardProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SongSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const availableMonths = useMemo(() => sortedMonths(dataset, person), [dataset, person]);
  const { startIndex, endIndex, lastIndex, rangeOptions, handleSliderChange, applyPreset } =
    useMonthRange(availableMonths, `leaderboard:${person}`);
  const {
    selected: selectedGenres,
    toggleTopLevel,
    toggleSubgenre,
    selectAll: selectAllGenres,
    selectNone: selectNoneGenres,
  } = useGenreFilter(person);
  const [maxRank, setMaxRank] = useRankFilter(person);

  // Combined options shared between the leaderboard list itself and the
  // StatsRow tiles above it, so "Top artist"/"Unique artists"/etc. always
  // match the currently selected range + genre + rank filter, never a stale
  // all-time figure independent of what's visibly displayed below. maxRank
  // of 25 (the default/full top 25) is passed through as undefined, same
  // "no filter" convention genreFilter would use if left unset.
  const combinedOptions: StatsOptions = useMemo(
    () => ({
      ...scoringOptions,
      ...rangeOptions,
      genreFilter: selectedGenres,
      maxRank: maxRank === 25 ? undefined : maxRank,
    }),
    [scoringOptions, rangeOptions, selectedGenres, maxRank]
  );

  const totals = useMemo(
    () => artistTotals(dataset, person, combinedOptions),
    [dataset, person, combinedOptions]
  );
  const colorMap = useMemo(
    () => buildArtistColorMap(totals.map((t) => t.artist)),
    [totals]
  );
  const max = totals[0]?.total ?? 1;
  const visible = totals.slice(0, limit);

  // Changing the range, scoring options, genre filter, or rank filter
  // changes which artists qualify at all - start back at the top rather
  // than keep a "show more" depth from a different filtered view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(
    () => setLimit(PAGE_SIZE),
    [person, scoringOptions, rangeOptions, selectedGenres, maxRank]
  );

  // If the range narrows and the expanded artist drops out of it entirely,
  // close the panel rather than show an empty "songs" list for them.
  const isExpandedStillPresent = useMemo(
    () => expanded !== null && totals.some((t) => t.artist === expanded),
    [expanded, totals]
  );
  const activeExpanded = isExpandedStillPresent ? expanded : null;

  const expandedTracks = useMemo(() => {
    if (!activeExpanded) return [];
    // Deliberately includes maxRank (so a song excluded from the artist's
    // total by the rank filter doesn't show up in their drill-down either)
    // but not genreFilter - the drill-down has always shown an artist's
    // full song list regardless of the genre checkboxes, since genreFilter
    // is a per-ARTIST cutoff (did THIS artist qualify), not a reason to
    // hide one of their own songs from them once they're shown at all.
    const tracks = tracksForArtist(dataset, activeExpanded, person, {
      ...scoringOptions,
      ...rangeOptions,
      maxRank: maxRank === 25 ? undefined : maxRank,
    });
    const sorted = [...tracks].sort((a, b) => {
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
    return sorted;
  }, [dataset, activeExpanded, person, scoringOptions, rangeOptions, maxRank, sortKey, sortDir]);

  function toggle(artist: string) {
    setExpanded((prev) => (prev === artist ? null : artist));
  }

  function handleSort(key: SongSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Date/rank read most naturally starting from newest/best; title/album
      // read most naturally starting A-first.
      setSortDir(key === "date" || key === "rank" ? "desc" : "asc");
    }
  }

  return (
    <div className={styles.wrap}>
      <StatsRow dataset={dataset} person={person} options={combinedOptions} />

      <div className={styles.headRow}>
        <h2 className={styles.heading}>Songs per artist</h2>
        <p className={styles.sub}>
          {totals.length} artists &middot; counts include feature credits and group/member
          attribution{scoringOptions.includeDuplicates === false &&
            " · repeat songs counted once"}
          {maxRank !== 25 && ` · only counting #1-${maxRank} each month`} &middot; click an artist
          to see their songs
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

      <RankFilter value={maxRank} onChange={setMaxRank} />

      <GenreFilter
        selected={selectedGenres}
        onToggleTopLevel={toggleTopLevel}
        onToggleSubgenre={toggleSubgenre}
        onSelectAll={selectAllGenres}
        onSelectNone={selectNoneGenres}
      />

      <ol className={styles.list}>
        {visible.map((row, index) => {
          const pct = (row.total / max) * 100;
          const color = colorMap.get(row.artist) ?? "var(--text-muted)";
          const isOpen = activeExpanded === row.artist;
          return (
            <li key={row.artist} className={styles.item}>
              <button
                type="button"
                className={styles.row}
                onClick={() => toggle(row.artist)}
                aria-expanded={isOpen}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.name} title={row.artist}>
                  {row.artist}
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

      {limit < totals.length && (
        <button type="button" className={styles.more} onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          Show more ({totals.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
