import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "../data/types";
import { allTracks, type StatsOptions } from "../lib/stats";
import { formatReleaseDate, yearBucketForTrack, decadeBucketForTrack } from "../lib/releaseEra";
import { formatDuration } from "../lib/durationBuckets";
import { useGenreFilter } from "../lib/useGenreFilter";
import { useRankFilter } from "../lib/useRankFilter";
import { usePersistedSetState } from "../lib/usePersistedState";
import { AlbumArt } from "./AlbumArt";
import { GenreFilter } from "./GenreFilter";
import { RankFilter } from "./RankFilter";
import { ArtistFilter } from "./ArtistFilter";
import { EraFilter } from "./EraFilter";
import leaderboardStyles from "./Leaderboard.module.css";
import styles from "./AllSongs.module.css";

interface AllSongsProps {
  dataset: Dataset;
  person: string;
  scoringOptions: StatsOptions;
}

type SongSortKey = "date" | "rank" | "title" | "album" | "artists" | "releaseDate" | "duration";
type SortDirection = "asc" | "desc";

const SONG_SORT_COLUMNS: Array<{ key: SongSortKey; label: string; mobileHidden?: boolean }> = [
  { key: "date", label: "Date" },
  { key: "rank", label: "#" },
  { key: "title", label: "Song" },
  { key: "album", label: "Album", mobileHidden: true },
  { key: "artists", label: "Artist(s)" },
  { key: "releaseDate", label: "Released", mobileHidden: true },
  { key: "duration", label: "Length", mobileHidden: true },
];

const PAGE_SIZE = 100;

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * A plain, person-scoped "every song they've ever picked" view - the exact
 * same row shape/column-sort behavior as Leaderboard's own per-artist
 * drill-down (Date/#/Song/Album/Artist(s)/Released/Length, click a header to
 * sort, click again to flip direction), just not nested under a bar-chart
 * row - this tab IS the song list, not a drill-down into one. Reuses
 * Leaderboard.module.css's songHeaderRow/songRow styling directly (same
 * precedent Shared.tsx's own drill-down already set for borrowing that
 * grid rather than duplicating it), and `allTracks` directly rather than
 * `tracksForArtist` - there's no artist to filter by here, this wants every
 * track for the person, unfiltered by artist/genre/rank.
 *
 * `scoringOptions.includeDuplicates` is honored exactly like every other
 * tab - off collapses a re-picked song to its one best-ranked occurrence
 * (via allTracks' own dedupeToBestOccurrence), on shows every monthly pick
 * including re-adds. No separate toggle needed here; this tab just reads
 * the same global checkbox every other view already does.
 *
 * Unlike Leaderboard's drill-down (which deliberately does NOT filter - the
 * project owner explicitly rejected a filtering search on the Leaderboard
 * itself in favor of a jump-to), this tab's search box DOES filter the row
 * list - confirmed directly ("should be a separate tab, with a search, and
 * the one that actually filters this time"), matching Shared's own
 * "The songs" search box behavior rather than Leaderboard's jump-to.
 *
 * **Also grew a collapsible "Filters" panel** (closed by default, so the
 * tab still reads as a plain list at a glance - the project owner's own
 * call when asked, keeping it out of the way rather than always-visible
 * like Leaderboard's equivalent controls) with Genre/Artist/Year/Decade/Rank
 * filters, all of which are genuine FILTERS here (narrowing the row list),
 * consistent with this tab's own search box and unlike Leaderboard's
 * jump-to. Genre and Rank reuse Leaderboard's exact components
 * (`GenreFilter`/`useGenreFilter`, `RankFilter`/`useRankFilter`) under their
 * own `"allSongs:${person}"`/`"allSongs"` persistence keys (separate from
 * Leaderboard's per-person ones, same "each tab's filter is independent"
 * precedent Shared's own `"shared"` genre-filter key established) - both
 * compose for free through `allTracks`'s existing `genreFilter`/`maxRank`
 * handling, no new filtering logic needed, since `allTracks` already
 * applies them per-artist/per-track before this component ever sees the
 * tracks. Year/Decade is a new `EraFilter` (a flat checkbox list, no
 * hierarchy - unlike genres, a release year/decade has no parent/child
 * relationship) filtering by `yearBucketForTrack`/`decadeBucketForTrack`
 * directly on each track. Implemented as two independent `EraFilter` panels
 * (Years, Decades) shown together rather than a mode switch, since - unlike
 * Leaderboard's Years/Decades mode (which replaces the ROW GROUPING
 * entirely) - here both are just independent narrowing filters that can
 * combine (e.g. "1990s" AND "1994" is redundant but harmless; "1990s" AND
 * "2005" legitimately excludes everything, same as selecting contradictory
 * genre checkboxes already can). Artist is a new
 * `ArtistFilter` (search + checklist + removable chips, Compare's own
 * picker pattern, since artist counts run into the hundreds here too) -
 * unlike the genre filter's "empty Set = show nobody" convention, an empty
 * artist selection here means "no artist filter" (show everyone), since
 * this is a search-to-narrow picker that starts with nothing explicitly
 * chosen rather than everything pre-selected; selectedArtists.size === 0 is
 * checked explicitly below before filtering on it.
 */
export function AllSongs({ dataset, person, scoringOptions }: AllSongsProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SongSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    selected: selectedGenres,
    toggleNode: toggleGenre,
    selectAll: selectAllGenres,
    selectNone: selectNoneGenres,
  } = useGenreFilter(`allSongs:${person}`);
  const [maxRank, setMaxRank] = useRankFilter("allSongs");
  const [selectedArtists, setSelectedArtists] = usePersistedSetState(
    `top25tracker:allSongsArtists:${person}`,
    () => []
  );
  const [selectedYears, setSelectedYears] = usePersistedSetState(
    `top25tracker:allSongsYears:${person}`,
    () => []
  );
  const [selectedDecades, setSelectedDecades] = usePersistedSetState(
    `top25tracker:allSongsDecades:${person}`,
    () => []
  );

  // Passes the full scoringOptions through (not just includeDuplicates) for
  // consistency with every other view, even though unite/producers/duos are
  // pure no-ops here: this list displays creditedArtists (the literal
  // credit), never scoringArtists, and has no genre/artist filter of its
  // own for those options to affect either - same "visible but inert"
  // precedent every non-artist Leaderboard/Timeline mode already follows
  // rather than this component needing to special-case which options it
  // forwards. genreFilter/maxRank DO need to be threaded through here
  // though - they're real per-artist/per-track cuts `allTracks` already
  // knows how to apply, same as Leaderboard's own combinedOptions.
  const trackOptions: StatsOptions = useMemo(
    () => ({
      ...scoringOptions,
      genreFilter: selectedGenres,
      maxRank: maxRank === 25 ? undefined : maxRank,
    }),
    [scoringOptions, selectedGenres, maxRank]
  );
  const tracks = useMemo(() => allTracks(dataset, person, trackOptions), [dataset, person, trackOptions]);

  // Every distinct credited artist this person has, with a song count - the
  // ArtistFilter picker's option list, sorted by count descending so the
  // most relevant names surface first without searching (same reasoning
  // Compare's own combinedArtistTotals sort gives). Built from `tracks`
  // itself (already genre/rank-filtered) rather than unfiltered data, so an
  // artist with zero songs left under the current genre/rank filter simply
  // doesn't appear as a checkable option.
  const artistOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tracks) {
      for (const a of t.creditedArtists) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [tracks]);

  // Every distinct release year/decade this person's (genre/rank-filtered)
  // tracks actually have, sorted ascending (years numerically, decades by
  // their own numeric prefix) - the EraFilter panels' own bucket lists.
  // "Unknown" (no catalogued release date) is included like every other
  // era-bucketing view in the app already does for its own checkbox list.
  const yearBuckets = useMemo(() => {
    const set = new Set(tracks.map((t) => yearBucketForTrack(t.releaseDate)));
    return Array.from(set).sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return Number(a) - Number(b);
    });
  }, [tracks]);
  const decadeBuckets = useMemo(() => {
    const set = new Set(tracks.map((t) => decadeBucketForTrack(t.releaseDate)));
    return Array.from(set).sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return Number(a.replace("s", "")) - Number(b.replace("s", ""));
    });
  }, [tracks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = q
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q) ||
            t.creditedArtists.some((a) => a.toLowerCase().includes(q))
        )
      : tracks;
    if (selectedArtists.size > 0) {
      base = base.filter((t) => t.creditedArtists.some((a) => selectedArtists.has(a)));
    }
    if (selectedYears.size > 0) {
      base = base.filter((t) => selectedYears.has(yearBucketForTrack(t.releaseDate)));
    }
    if (selectedDecades.size > 0) {
      base = base.filter((t) => selectedDecades.has(decadeBucketForTrack(t.releaseDate)));
    }
    return [...base].sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case "date":
          // Same "true earliest add" convention as Leaderboard's own
          // drill-down - firstMonth (present only when a repeat collapsed
          // onto a later, better-ranked occurrence) reflects when the song
          // was actually first picked, not the kept occurrence's month.
          cmp = (a.firstMonth ?? a.month).localeCompare(b.firstMonth ?? b.month);
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
        case "artists":
          cmp = a.creditedArtists.join(", ").localeCompare(b.creditedArtists.join(", "));
          break;
        case "releaseDate":
          if (a.releaseDate === null && b.releaseDate === null) cmp = 0;
          else if (a.releaseDate === null) cmp = 1;
          else if (b.releaseDate === null) cmp = -1;
          else cmp = a.releaseDate.localeCompare(b.releaseDate);
          break;
        case "duration":
          if (a.durationMs === null && b.durationMs === null) cmp = 0;
          else if (a.durationMs === null) cmp = 1;
          else if (b.durationMs === null) cmp = -1;
          else cmp = a.durationMs - b.durationMs;
          break;
      }
      if (sortKey === "releaseDate" || sortKey === "duration") {
        const aMissing = sortKey === "releaseDate" ? a.releaseDate === null : a.durationMs === null;
        const bMissing = sortKey === "releaseDate" ? b.releaseDate === null : b.durationMs === null;
        if (aMissing || bMissing) return cmp;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tracks, query, sortKey, sortDir, selectedArtists, selectedYears, selectedDecades]);

  // A new search/person/dedup toggle changes the underlying set entirely -
  // an old "show more" depth from a different filtered list isn't
  // meaningful once what's being paged through has changed, same reasoning
  // Shared's own songLimit reset effect uses (identical pattern there,
  // without this warning - a quirk of which lint rule run flags it).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLimit(PAGE_SIZE), [filtered]);
  const visible = filtered.slice(0, limit);

  function handleSort(key: SongSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "date" || key === "rank" || key === "releaseDate" || key === "duration"
          ? "desc"
          : "asc"
      );
    }
  }

  function toggleArtist(name: string) {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleYear(bucket: string) {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

  function toggleDecade(bucket: string) {
    setSelectedDecades((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

  const activeFilterCount =
    (selectedArtists.size > 0 ? 1 : 0) +
    (selectedYears.size > 0 ? 1 : 0) +
    (selectedDecades.size > 0 ? 1 : 0) +
    (maxRank !== 25 ? 1 : 0);
  // selectedGenres doesn't count toward this badge the same way - it's
  // "everything selected" by default (no filter), not "nothing selected"
  // like the other sets here, so its own "is this actually filtering
  // anything" check is a size comparison against ALL_TOP_LEVEL rather than
  // > 0; the genre filter's own panel already shows which boxes are
  // unchecked, so this badge omitting it isn't a loss of information.

  return (
    <div className={leaderboardStyles.wrap}>
      <div className={leaderboardStyles.headRow}>
        <div>
          <h2 className={leaderboardStyles.heading}>All songs</h2>
          <p className={leaderboardStyles.sub}>
            {filtered.length} of {tracks.length} songs
            {scoringOptions.includeDuplicates === false && " · repeat songs counted once"}
          </p>
        </div>
        <button
          type="button"
          className={styles.filtersToggle}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
      </div>

      {filtersOpen && (
        <div className={styles.filtersPanel}>
          <div className={leaderboardStyles.filterRow}>
            <RankFilter value={maxRank} onChange={setMaxRank} />
          </div>

          <GenreFilter
            selected={selectedGenres}
            onToggle={toggleGenre}
            onSelectAll={selectAllGenres}
            onSelectNone={selectNoneGenres}
          />

          <ArtistFilter
            options={artistOptions}
            selected={selectedArtists}
            onToggle={toggleArtist}
            onClear={() => setSelectedArtists(new Set())}
          />

          <EraFilter
            label="Filter by release year"
            buckets={yearBuckets}
            selected={selectedYears}
            onToggle={toggleYear}
            onSelectAll={() => setSelectedYears(new Set(yearBuckets))}
            onSelectNone={() => setSelectedYears(new Set())}
          />

          <EraFilter
            label="Filter by release decade"
            buckets={decadeBuckets}
            selected={selectedDecades}
            onToggle={toggleDecade}
            onSelectAll={() => setSelectedDecades(new Set(decadeBuckets))}
            onSelectNone={() => setSelectedDecades(new Set())}
          />
        </div>
      )}

      <input
        type="text"
        className={styles.search}
        placeholder="Filter by song, artist, or album..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className={styles.empty}>No matches.</p>
      ) : (
        <>
          <div className={leaderboardStyles.songHeaderRow}>
            <span aria-hidden="true" />
            {SONG_SORT_COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                className={
                  col.mobileHidden
                    ? `${leaderboardStyles.songHeaderButton} ${leaderboardStyles.hideOnMobile}`
                    : leaderboardStyles.songHeaderButton
                }
                onClick={() => handleSort(col.key)}
                data-active={sortKey === col.key}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className={leaderboardStyles.sortArrow} aria-hidden="true">
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            ))}
          </div>
          <ul className={leaderboardStyles.songList}>
            {visible.map((track, i) => (
              <li key={`${track.month}-${track.rank}-${i}`} className={leaderboardStyles.songRow}>
                <AlbumArt
                  spotifyId={track.spotifyId}
                  alt={track.album || track.title}
                  className={leaderboardStyles.songArt}
                />
                <span className={leaderboardStyles.songMonth}>
                  {formatMonth(track.firstMonth ?? track.month)}
                </span>
                <span className={leaderboardStyles.songRank}>#{track.rank}</span>
                <span className={leaderboardStyles.songTitle} title={track.title}>
                  {track.title}
                </span>
                <span
                  className={`${leaderboardStyles.songAlbum} ${leaderboardStyles.hideOnMobile}`}
                  title={track.album}
                >
                  {track.album}
                </span>
                <span
                  className={leaderboardStyles.songArtists}
                  title={track.creditedArtists.join(", ")}
                >
                  {track.creditedArtists.join(", ")}
                </span>
                <span className={`${leaderboardStyles.songReleaseDate} ${leaderboardStyles.hideOnMobile}`}>
                  {formatReleaseDate(track.releaseDate) ?? "—"}
                </span>
                <span className={`${leaderboardStyles.songDuration} ${leaderboardStyles.hideOnMobile}`}>
                  {formatDuration(track.durationMs) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {limit < filtered.length && (
        <button
          type="button"
          className={leaderboardStyles.more}
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
        >
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
