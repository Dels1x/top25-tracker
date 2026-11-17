import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "../data/types";
import { allTracks, type StatsOptions } from "../lib/stats";
import { formatReleaseDate } from "../lib/releaseEra";
import { formatDuration } from "../lib/durationBuckets";
import { AlbumArt } from "./AlbumArt";
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
 */
export function AllSongs({ dataset, person, scoringOptions }: AllSongsProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SongSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Passes the full scoringOptions through (not just includeDuplicates) for
  // consistency with every other view, even though unite/producers/duos are
  // pure no-ops here: this list displays creditedArtists (the literal
  // credit), never scoringArtists, and has no genre/artist filter of its
  // own for those options to affect either - same "visible but inert"
  // precedent every non-artist Leaderboard/Timeline mode already follows
  // rather than this component needing to special-case which options it
  // forwards.
  const tracks = useMemo(() => allTracks(dataset, person, scoringOptions), [dataset, person, scoringOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q) ||
            t.creditedArtists.some((a) => a.toLowerCase().includes(q))
        )
      : tracks;
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
  }, [tracks, query, sortKey, sortDir]);

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

  return (
    <div className={leaderboardStyles.wrap}>
      <div className={leaderboardStyles.headRow}>
        <div>
          <h2 className={leaderboardStyles.heading}>All songs</h2>
          <p className={leaderboardStyles.sub}>
            {tracks.length} songs
            {scoringOptions.includeDuplicates === false && " · repeat songs counted once"}
          </p>
        </div>
      </div>

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
