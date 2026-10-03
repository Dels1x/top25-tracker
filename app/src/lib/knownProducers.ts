/**
 * Hand-maintained set of credited names that are, in this dataset, always a
 * PRODUCER credit rather than a vocalist/rapper credit - used to power the
 * "show producers" checkbox (opt-in, default OFF; see
 * StatsOptions.showProducers in stats.ts).
 *
 * Why this has to be a manual list rather than something derived from the
 * CSV: there is no dedicated "producer" column in the Spotify/Exportify
 * export - a producer only shows up because they happen to also be listed
 * in `Artist Name(s)`, the same field a track's rapper/singer is listed in,
 * and whether a given track does that is inconsistent (some tracks credit
 * the producer, most don't). So this list can only say "when THIS name
 * shows up, it's a producer" for names that are unambiguous in practice.
 *
 * Deliberately excludes anyone who is ALSO a legitimate lead artist
 * somewhere in this data - e.g. J Dilla (sole credited artist on his own
 * instrumental album, "Donuts") and El-P (a vocalist in Run The Jewels,
 * already in GROUP_MEMBERS). Toggling producers off must never hide a
 * track where the "producer" genuinely is the artist.
 */
export const KNOWN_PRODUCERS: ReadonlySet<string> = new Set([
  "Kenny Segal",
  "The Alchemist",
  "Madlib",
  "DJ Premier",
  "Metro Boomin",
  "Pete Rock",
  "9th Wonder",
  "Hit-Boy",
  "Oh No",
  "BADBADNOTGOOD",
  "Flying Lotus",
  "Statik Selektah",
  "Zaytoven",
  "Southside",
  "Tay Keith",
  // Add more here only when the name is unambiguously producer-only across
  // every track it appears on in this dataset - check before adding, the
  // same way J Dilla/El-P were checked and excluded.
]);

export function isKnownProducer(name: string): boolean {
  return KNOWN_PRODUCERS.has(name);
}
