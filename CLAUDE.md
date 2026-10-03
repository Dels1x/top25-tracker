# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project concept

A fun stats/visualization site for a recurring game played by the user and two friends: each month,
each person picks their top 25 favorite songs of that month, ranked 1 (best) to 25 (least, but still a
favorite). The site will turn the accumulated monthly lists into stats and charts — e.g. songs per
artist, a timeline of tracks added per artist per month (with per-artist show/hide toggles), and
possibly a "replay" animation of tracks being added over time.

No application code exists yet — this repo currently contains only the raw monthly CSV exports that
will be the data source. There is no build system, package manager, test runner, or framework chosen
yet. When scaffolding the app, pick a stack and record the actual commands here (dev server, build,
lint, test) — don't invent them speculatively.

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
