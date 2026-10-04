import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "../data/types";
import {
  artistTotals,
  genreTotals,
  sortedMonths,
  tracksForArtist,
  tracksForGenre,
  type StatsOptions,
} from "../lib/stats";
import { buildArtistColorMap } from "../lib/colors";
import { usePersistedState } from "../lib/usePersistedState";
import { useMonthRange } from "../lib/useMonthRange";
import { useGenreFilter } from "../lib/useGenreFilter";
import { useRankFilter } from "../lib/useRankFilter";
import { useWeightByRank } from "../lib/useWeightByRank";
import { RangePicker } from "./RangePicker";
import { GenreFilter } from "./GenreFilter";
import { RankFilter } from "./RankFilter";
import { ToggleCheckbox } from "./ToggleCheckbox";
import { ModeSwitch } from "./ModeSwitch";
import { StatsRow } from "./StatsRow";
import styles from "./Leaderboard.module.css";

interface LeaderboardProps {
  dataset: Dataset;
  person: string;
  scoringOptions: StatsOptions;
}

type Mode = "artists" | "genres";

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

/**
 * Songs-per-artist bar list, OR (via the Artists/Genres mode switch, same
 * visual language as Compare's own mode switch) songs-per-genre - these used
 * to be two separate tabs/components (Leaderboard + GenreLeaderboard) that
 * were nearly identical in shape, differing only in which stats.ts functions
 * they called and which artist-only controls (RankFilter, "weight by
 * placement", the genre filter itself, StatsRow) applied. Merged into one
 * component rather than kept as two, mirroring how Compare already merges
 * its own artists/genres split into one view instead of two tabs.
 *
 * In "genres" mode: RankFilter, "weight by placement", the GenreFilter panel
 * (filtering genre rows BY genre makes no sense), and StatsRow (its "Top
 * artist" tile has no genre equivalent) all hide - this exactly matches what
 * the old standalone GenreLeaderboard showed, nothing more. The 3
 * artist-identity checkboxes (unite/producers/duos) from `scoringOptions`
 * are NOT hidden in genre mode though, matching Compare's own precedent -
 * they're harmless no-ops there (genreTotals/tracksForGenre simply don't
 * look at them) rather than something the component itself needs to hide.
 */
export function Leaderboard({ dataset, person, scoringOptions }: LeaderboardProps) {
  const [mode, setMode] = usePersistedState<Mode>("top25tracker:leaderboardMode", "artists");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SongSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const isGenreMode = mode === "genres";

  const availableMonths = useMemo(() => sortedMonths(dataset, person), [dataset, person]);
  const {
    startIndex,
    endIndex,
    lastIndex,
    rangeOptions,
    availableYears,
    handleSliderChange,
    applyPreset,
    applyYear,
  } = useMonthRange(availableMonths, `leaderboard:${person}`);
  const {
    selected: selectedGenres,
    toggleNode: toggleGenre,
    selectAll: selectAllGenres,
    selectNone: selectNoneGenres,
  } = useGenreFilter(person);
  const [maxRank, setMaxRank] = useRankFilter(person);
  const [weightByRank, setWeightByRank] = useWeightByRank(person);

  // Only includeDuplicates/startMonth/endMonth are meaningful for genres -
  // the artist-identity options (unite/producers/duos) don't apply, same as
  // the old standalone GenreLeaderboard.
  const genreOptions: StatsOptions = useMemo(
    () => ({ includeDuplicates: scoringOptions.includeDuplicates, ...rangeOptions }),
    [scoringOptions.includeDuplicates, rangeOptions]
  );

  // Combined options shared between the leaderboard list itself and the
  // StatsRow tiles above it (artists mode only - StatsRow has no genre
  // equivalent), so "Top artist"/"Unique artists"/etc. always match the
  // currently selected range + genre + rank filter, never a stale all-time
  // figure independent of what's visibly displayed below. maxRank of 25
  // (the default/full top 25) is passed through as undefined, same "no
  // filter" convention genreFilter would use if left unset.
  const combinedOptions: StatsOptions = useMemo(
    () => ({
      ...scoringOptions,
      ...rangeOptions,
      genreFilter: selectedGenres,
      maxRank: maxRank === 25 ? undefined : maxRank,
      weightByRank,
    }),
    [scoringOptions, rangeOptions, selectedGenres, maxRank, weightByRank]
  );

  const artistRows = useMemo(
    () => artistTotals(dataset, person, combinedOptions),
    [dataset, person, combinedOptions]
  );
  const genreRows = useMemo(
    () => genreTotals(dataset, person, genreOptions),
    [dataset, person, genreOptions]
  );
  const totals: Array<{ name: string; total: number; count: number }> = isGenreMode
    ? genreRows.map((r) => ({ name: r.genre, total: r.total, count: r.total }))
    : artistRows.map((r) => ({ name: r.artist, total: r.total, count: r.count }));

  // Color must follow the ARTIST/GENRE, never its current rank in this
  // filtered view - so the color map is built from a STABLE ordering
  // (all-time totals for this person, under the identity toggles only -
  // never range/genre/rank/weight, which all reshuffle order without
  // changing who the artist is) rather than from `totals` itself. Without
  // this, swapping the range or turning on "weight by placement" would
  // reshuffle bar colors right along with the rows, which defeats the point
  // of color-coding by entity.
  const stableArtistOrder = useMemo(
    () => artistTotals(dataset, person, scoringOptions).map((t) => t.artist),
    [dataset, person, scoringOptions]
  );
  const stableGenreOrder = useMemo(
    () =>
      genreTotals(dataset, person, { includeDuplicates: scoringOptions.includeDuplicates }).map(
        (t) => t.genre
      ),
    [dataset, person, scoringOptions.includeDuplicates]
  );
  const colorMap = useMemo(
    () => buildArtistColorMap(isGenreMode ? stableGenreOrder : stableArtistOrder),
    [isGenreMode, stableGenreOrder, stableArtistOrder]
  );

  const max = totals[0]?.total ?? 1;
  // No pagination in genre mode - only ~19 genre/subgenre buckets total (see
  // artistGenres.ts), unlike the potentially hundreds of artists.
  const visible = isGenreMode ? totals : totals.slice(0, limit);

  // Changing the range, scoring options, genre filter, rank filter, or mode
  // changes which rows qualify/exist at all - start back at the top rather
  // than keep a "show more" depth from a different filtered view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(
    () => setLimit(PAGE_SIZE),
    [mode, person, scoringOptions, rangeOptions, selectedGenres, maxRank, weightByRank]
  );

  // If the range/mode changes and the expanded row drops out entirely, close
  // the panel rather than show an empty "songs" list for it.
  const isExpandedStillPresent = useMemo(
    () => expanded !== null && totals.some((t) => t.name === expanded),
    [expanded, totals]
  );
  const activeExpanded = isExpandedStillPresent ? expanded : null;

  const expandedTracks = useMemo(() => {
    if (!activeExpanded) return [];
    const tracks = isGenreMode
      ? tracksForGenre(dataset, activeExpanded, person, genreOptions)
      : // Deliberately includes maxRank (so a song excluded from the
        // artist's total by the rank filter doesn't show up in their
        // drill-down either) but not genreFilter - the drill-down has
        // always shown an artist's full song list regardless of the genre
        // checkboxes, since genreFilter is a per-ARTIST cutoff (did THIS
        // artist qualify), not a reason to hide one of their own songs from
        // them once they're shown at all.
        tracksForArtist(dataset, activeExpanded, person, {
          ...scoringOptions,
          ...rangeOptions,
          maxRank: maxRank === 25 ? undefined : maxRank,
        });
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
  }, [
    dataset,
    activeExpanded,
    person,
    isGenreMode,
    genreOptions,
    scoringOptions,
    rangeOptions,
    maxRank,
    sortKey,
    sortDir,
  ]);

  function toggle(name: string) {
    setExpanded((prev) => (prev === name ? null : name));
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

  function switchMode(next: Mode) {
    setMode(next);
    setExpanded(null);
  }

  const noun = isGenreMode ? "genre" : "artist";

  return (
    <div className={styles.wrap}>
      {!isGenreMode && <StatsRow dataset={dataset} person={person} options={combinedOptions} />}

      <div className={styles.headRow}>
        <div>
          <h2 className={styles.heading}>Songs per {noun}</h2>
          <p className={styles.sub}>
            {isGenreMode ? (
              <>
                {scoringOptions.includeDuplicates === false && " · repeat songs counted once"}
                &middot; click a genre to see its songs
              </>
            ) : (
              <>
                {totals.length} artists &middot; counts include feature credits and group/member
                attribution{scoringOptions.includeDuplicates === false &&
                  " · repeat songs counted once"}
                {maxRank !== 25 && ` · only counting #1-${maxRank} each month`}
                {weightByRank && " · weighted by placement"} &middot; click an artist to see their
                songs
              </>
            )}
          </p>
        </div>
        <ModeSwitch
          value={mode}
          options={[
            { value: "artists", label: "Artists" },
            { value: "genres", label: "Genres" },
          ]}
          onChange={switchMode}
          aria-label="Rank by"
        />
      </div>

      <RangePicker
        months={availableMonths}
        startIndex={startIndex}
        endIndex={endIndex}
        lastIndex={lastIndex}
        availableYears={availableYears}
        onSliderChange={handleSliderChange}
        onPreset={applyPreset}
        onYear={applyYear}
      />

      {!isGenreMode && (
        <>
          <div className={styles.filterRow}>
            <RankFilter value={maxRank} onChange={setMaxRank} />
            <ToggleCheckbox
              checked={weightByRank}
              onChange={setWeightByRank}
              label="Weight by placement (#1 worth more than #25)"
            />
          </div>

          <GenreFilter
            selected={selectedGenres}
            onToggle={toggleGenre}
            onSelectAll={selectAllGenres}
            onSelectNone={selectNoneGenres}
          />
        </>
      )}

      <ol className={styles.list}>
        {visible.map((row, index) => {
          const pct = (row.total / max) * 100;
          const color = colorMap.get(row.name) ?? "var(--text-muted)";
          const isOpen = activeExpanded === row.name;
          return (
            <li key={row.name} className={styles.item}>
              <button
                type="button"
                className={styles.row}
                onClick={() => toggle(row.name)}
                aria-expanded={isOpen}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.name} title={row.name}>
                  {row.name}
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
                <span className={styles.value}>
                  {!isGenreMode && weightByRank
                    ? `${Math.round(row.total)}pts (${row.count})`
                    : row.total}
                </span>
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

      {!isGenreMode && limit < totals.length && (
        <button type="button" className={styles.more} onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          Show more ({totals.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
