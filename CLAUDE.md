# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project concept

A fun stats/visualization site for a recurring game played by the user and two friends: each month,
each person picks their top 25 favorite songs of that month, ranked 1 (best) to 25 (least, but still a
favorite). The site will turn the accumulated monthly lists into stats and charts — e.g. songs per
artist, a timeline of tracks added per artist per month (with per-artist show/hide toggles), and
possibly a "replay" animation of tracks being added over time.

## Commands

All commands run from `app/`:

- `npm run dev` — start the Vite dev server (auto-runs `build:data` first via the `predev` hook).
- `npm run build` — type-check + production build (auto-runs `build:data` first via `prebuild`).
- `npm run build:data` — regenerate `src/data/data.json` from the CSVs under `top25/csv/`. Run this
  manually any time you edit/add a CSV and want fresh data without a full dev-server restart.
- `npm run lint` — oxlint.
- `npm run preview` — serve the production build locally.

There is no test runner configured yet.

## Architecture

- **`app/scripts/buildData.ts`** — the entire data pipeline. Reads every `top25/csv/<person>/*.csv`,
  parses the Spotify/Exportify schema with Papa Parse, splits `Artist Name(s)` on `;`, applies group
  attribution, and writes the normalized result to `app/src/data/data.json`. This file is
  **gitignored and regenerated on every dev/build** (see `predev`/`prebuild` in `package.json`) — the
  CSVs are the single source of truth, never hand-edit `data.json`.
- **`app/scripts/groupAttribution.ts`** — the hand-maintained `GROUP_MEMBERS` lookup table implementing
  the duo/group scoring rule below. Add new groups here as they show up in someone's top 25.
- **`app/src/data/types.ts`** — shared shape (`Dataset` / `MonthlyList` / `Track`) for the JSON produced
  by the build script and consumed by the frontend. Each `Track` carries both `creditedArtists` (as
  literally written in the CSV) and `scoringArtists` (after group expansion) — stats/charts should
  always aggregate on `scoringArtists`.
- **`app/src/lib/stats.ts`** — pure aggregation functions (artist totals, per-month counts, cumulative
  time series) over a `Dataset`. UI components call these rather than recomputing aggregates inline.
- **`app/src/lib/colors.ts`** — assigns each artist a fixed categorical color slot by stable rank order
  (see the dataviz skill's "color follows the entity, never its rank" rule) — a toggled-off artist must
  never cause the remaining artists to repaint.
- **`app/src/components/`** — `Leaderboard` (songs-per-artist bar list), `Timeline` (cumulative line
  chart with per-artist toggle legend), `Replay` (month-by-month animated reveal), plus `Layout` /
  `StatsRow` / `StatTile` shell pieces. `App.tsx` just wires person/view selection state and imports
  `data.json` directly (no runtime CSV parsing, no backend/API).
- Styling is CSS Modules per-component, with design tokens (colors, surfaces) as CSS custom properties
  in `src/index.css`, following the project's dataviz skill palette for both light and dark mode.
- **`app/src/lib/usePersistedState.ts`** — `usePersistedState`/`usePersistedSetState` wrap `useState`
  with a `localStorage` round-trip (no cookies/server — this is purely a per-browser UI convenience).
  Used for the active person, active view, the "include duplicates" checkbox, and the Timeline's
  selected-artist set. The Timeline's selection is persisted **per person** (key includes the person
  name) since each person has a different artist pool. A stored person/view can go stale (dataset
  changes, old build) — `App.tsx` validates against `dataset.people`/the known view ids and falls back
  rather than rendering garbage; don't assume a value read back from storage is still valid.

### Scoring rules (per the project owner — not derivable from the data itself)

- Each track in a monthly top-25 list contributes to its artist's count/score for that month. Rank
  position (1–25) matters for "best of" framing but a track counts even at #25.
- **Features count**: if a track has a featured artist (e.g. "feat. X" in the title, or a secondary
  name in the artist field), the featured artist gets a full point too — same as the primary artist.
- **Group/duo attribution**: if a track is credited to a duo/group whose individual members also have
  independent solo careers, and the track credit does NOT separately name those members, each member
  individually gets a full point in addition to (or standing in for) the group credit. Canonical
  example from the owner: a track credited to "Armand Hammer" (the duo) with no separate mention of
  billy woods or E L U C I D should award a full point to both billy woods and E L U C I D individually.
  This mapping (group → constituent members) is not in the CSVs and will need a manually maintained
  lookup table when implementing scoring logic.
- **"Include duplicates" toggle** (`includeDuplicates` option throughout `src/lib/stats.ts`): when off,
  a song that appears in more than one month's top 25 counts once overall per artist (toward its first
  chronological appearance), not once per occurrence. "The same song" is matched via `trackKey`
  (normalized title + credited-artist list), not raw title equality — Spotify/Exportify re-releases the
  same recording under multiple catalog titles (e.g. `"X - Single Version"` vs `"X"`, `"X - 2005
  Remaster"`), and those must still collapse together or the toggle undercounts. `normalizeTitle` in
  `stats.ts` strips a known, narrow set of trailing release-tag words (version/edit/edition/remaster +
  a descriptor like year/explicit/album/single/radio/extended/deluxe/tv/digital/mono/stereo) — it
  deliberately does NOT strip "(Remix)", "- Live", or other suffixes that denote an actually different
  recording someone chose on purpose, and never touches "(feat. ...)". If a future CSV introduces a new
  re-release tag style that isn't collapsing correctly, extend the descriptor/noun word lists there
  rather than loosening the match to something broader (a false merge of two genuinely different songs
  is worse than missing an exotic tag).

## Data layout

```
top25/csv/<person>/<YYYY>-<MM>.csv
```

e.g. `top25/csv/delsix/2024-04.csv` for the user's April 2024 top 25. One file per person per month —
this is an enforced naming convention, not something to detect. `top25/csv/delsix/` is the user's own
folder; two more sibling folders (one per friend) will be added later with the same structure. Code
that discovers/parses these files should treat the folder name under `csv/` as the person identifier
and not hardcode `delsix`, and should get the month/year for a file **from its filename**, never from
any in-file "Added At"/date column — tracks get retroactively re-added (e.g. swapping a single for the
album version after it releases, or re-adding after an accidental removal), so a track's add timestamp
does not reliably reflect which month's top-25 list it belongs to. The filename (i.e. which list it was
placed in) is the source of truth for month attribution.

This convention was established by migrating from the original export filenames (which used
inconsistent "Top 25 (Month Year).csv" / "Top_25_(Month_Year).csv" styles, including a "Jule" typo for
July). Some months had been exported twice by different tools as redundant re-exports of the same
25 tracks (different columns, same songs) — those extras were deleted, keeping one canonical file per
month. **New monthly files should be added directly as `YYYY-MM.csv`** to keep this consistent — don't
reintroduce free-form naming.

Note: filenames (and in-file `Added At` columns, where present) can carry dates in 2026 and later —
this is placeholder/test data reaching into the future, not a bug to "fix" to the current date.

### CSV schema

The canonical files are all Spotify/Exportify-style exports — header starts `Track URI,ISRC,Track
Name,Album Name,Artist Name(s),Release Date,Duration (ms),Popularity,Explicit,Added By,Added
At,Genres,Record Label,Danceability,Energy,...`. Rank/position is implicit in row order (row 1 = #1),
not a column. Multi-artist credits are **semicolon**-separated in `Artist Name(s)` (e.g.
`"Eminem;Dido"`) — parse with a real CSV parser regardless, since other fields (Genres, Track Name)
can contain commas.

- Can contain `spotify:local:...` URI rows for locally-matched files (no streaming ISRC) — these rows
  have empty ISRC and empty audio-feature columns; handle as valid tracks with missing metadata, not
  as errors.
- Don't assume every future monthly file will match this exact header forever (different export tools
  were used historically — see migration note above). Detect the schema from the header row rather
  than hardcoding column positions, and treat an unrecognized header as a signal to fall back to a
  more lenient parser rather than crashing.
