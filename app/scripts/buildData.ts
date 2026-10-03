/**
 * Reads every person's monthly top-25 CSVs from top25/csv/<person>/YYYY-MM.csv,
 * normalizes them into the shared Dataset shape (see src/data/types.ts),
 * applies scoring/group attribution, and writes src/data/data.json for the
 * frontend to import directly (no runtime CSV parsing).
 *
 * Run with: npm run build:data
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { expandCreditedArtists } from "./artistAttribution.ts";
import type { Dataset, MonthlyList, Track } from "../src/data/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_ROOT = join(__dirname, "..", "..", "top25", "csv");
const OUTPUT_PATH = join(__dirname, "..", "src", "data", "data.json");

const FILENAME_RE = /^(\d{4})-(\d{2})\.csv$/;

/** Strip a leading UTF-8 BOM, which Exportify-style exports include. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Split an "Artist Name(s)" field from the Spotify/Exportify schema.
 * That schema delimits multiple artists with ';'.
 */
function splitArtists(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitGenres(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface RawRow {
  "Track URI": string;
  ISRC: string;
  "Track Name": string;
  "Album Name": string;
  "Artist Name(s)": string;
  "Release Date": string;
  Genres: string;
  [key: string]: string;
}

function parseMonthFile(person: string, filename: string, csvText: string): MonthlyList {
  const match = FILENAME_RE.exec(filename);
  if (!match) {
    throw new Error(`Unexpected filename "${filename}" for person "${person}" - expected YYYY-MM.csv`);
  }
  const [, yearStr, monthStr] = match;
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  const parsed = Papa.parse<RawRow>(stripBom(csvText), {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const fatal = parsed.errors.filter((e) => e.type !== "FieldMismatch");
    if (fatal.length > 0) {
      throw new Error(
        `CSV parse errors in ${person}/${filename}: ${fatal.map((e) => e.message).join("; ")}`
      );
    }
  }

  const header = parsed.meta.fields ?? [];
  if (!header.includes("Track URI") || !header.includes("Artist Name(s)")) {
    throw new Error(
      `${person}/${filename} does not match the expected Spotify/Exportify schema ` +
        `(missing "Track URI" or "Artist Name(s)" column). Header was: ${header.join(", ")}`
    );
  }

  const tracks: Track[] = parsed.data
    .filter((row) => row["Track Name"] && row["Artist Name(s)"])
    .map((row, index) => {
      const creditedArtists = splitArtists(row["Artist Name(s)"]);
      return {
        rank: index + 1,
        title: row["Track Name"].trim(),
        creditedArtists,
        scoringArtists: expandCreditedArtists(creditedArtists),
        album: (row["Album Name"] ?? "").trim(),
        releaseDate: row["Release Date"]?.trim() || null,
        spotifyId: row["Track URI"]?.startsWith("spotify:track:")
          ? row["Track URI"].slice("spotify:track:".length)
          : null,
        isrc: row.ISRC?.trim() || null,
        genres: splitGenres(row.Genres ?? ""),
      };
    });

  if (tracks.length === 0) {
    throw new Error(`${person}/${filename} produced zero tracks - check the file contents.`);
  }

  return {
    person,
    month: `${yearStr}-${monthStr}`,
    year,
    monthNum,
    tracks,
  };
}

function buildDataset(): Dataset {
  if (!existsSync(CSV_ROOT)) {
    throw new Error(`CSV root not found: ${CSV_ROOT}`);
  }

  const people = readdirSync(CSV_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (people.length === 0) {
    throw new Error(`No person folders found under ${CSV_ROOT}`);
  }

  const lists: MonthlyList[] = [];

  for (const person of people) {
    const personDir = join(CSV_ROOT, person);
    const files = readdirSync(personDir).filter((f) => f.endsWith(".csv"));

    for (const filename of files) {
      if (!FILENAME_RE.test(filename)) {
        console.warn(
          `Skipping ${person}/${filename}: does not match YYYY-MM.csv naming convention.`
        );
        continue;
      }
      const csvText = readFileSync(join(personDir, filename), "utf-8");
      lists.push(parseMonthFile(person, filename, csvText));
    }
  }

  lists.sort((a, b) => a.person.localeCompare(b.person) || a.month.localeCompare(b.month));

  return {
    people,
    lists,
    generatedAt: new Date().toISOString(),
  };
}

const dataset = buildDataset();
writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2));

const totalTracks = dataset.lists.reduce((sum, l) => sum + l.tracks.length, 0);
console.log(
  `Wrote ${OUTPUT_PATH}\n` +
    `  people: ${dataset.people.join(", ")}\n` +
    `  months: ${dataset.lists.length}\n` +
    `  tracks: ${totalTracks}`
);
