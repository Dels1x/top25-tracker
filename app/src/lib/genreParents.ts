/**
 * Maps a Spotify micro-genre tag (as it appears in Track.genres - there are
 * ~200 distinct ones across this dataset, e.g. "g-funk", "shoegaze",
 * "shibuya-kei") to one of a small set of major genre buckets for the
 * Genres leaderboard/timeline. A track keeps ALL of its original genres in
 * `genres` (untouched) - this table is only consulted when building the
 * genre-scoped stats, and a track with tags spanning more than one bucket
 * (e.g. "rap metal" -> both Hip-Hop and Metal) counts toward every bucket
 * its tags touch, same way a track with multiple credited artists counts
 * toward each of them.
 *
 * Hand-maintained, not derivable algorithmically - built by walking every
 * distinct tag actually present in this dataset (see `npm run build:data`
 * output or scripts/buildData.ts) and placing it by ear/standard genre
 * taxonomy. A tag not in this map falls back to "Other" (see
 * `GENRE_FALLBACK` below) rather than crashing - if a new tag shows up in a
 * future CSV that deserves a better bucket than "Other", add it here.
 *
 * Judgment calls worth knowing about:
 * - Hybrid tags (rap metal, rap rock, trap metal, crunk, country hip hop,
 *   christian hip hop) map to BOTH parent buckets they bridge.
 * - The lo-fi / indie-folk / slowcore / anti-folk cluster is bucketed as
 *   Folk (closer to acoustic/singer-songwriter lineage) rather than Rock;
 *   post-rock/math rock/shoegaze/grunge-family tags go to Rock instead
 *   since they're built on rock instrumentation and lineage.
 * - disco/funk/motown go to R&B/Soul rather than Pop.
 * - World-music tags with no clean fit in this taxonomy (bachata, kompa,
 *   kizomba, zouk, raï, parang, música adventista, exotica, schlager,
 *   schlagerparty, neue deutsche welle) are left in "Other" rather than
 *   force-fit into a Western-genre bucket that would misrepresent them.
 */
export const GENRES = [
  "Hip-Hop",
  "Rock",
  "Metal",
  "Jazz",
  "R&B/Soul",
  "Folk",
  "Electronic",
  "Pop",
  "Reggae",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];

/** Shown for a track with an empty `genres` array (no Spotify genre data at all). */
export const UNTAGGED_GENRE = "Unknown/Untagged";

const MAP: Record<string, Genre[]> = {
  // --- Hip-Hop ---
  "alternative hip hop": ["Hip-Hop"],
  "boom bap": ["Hip-Hop"],
  "chicago drill": ["Hip-Hop"],
  "cloud rap": ["Hip-Hop"],
  "country hip hop": ["Hip-Hop", "Folk"],
  "christian hip hop": ["Hip-Hop"],
  drill: ["Hip-Hop"],
  "east coast hip hop": ["Hip-Hop"],
  "emo rap": ["Hip-Hop"],
  "experimental hip hop": ["Hip-Hop"],
  "g-funk": ["Hip-Hop"],
  "gangster rap": ["Hip-Hop"],
  grime: ["Hip-Hop"],
  "hardcore hip hop": ["Hip-Hop"],
  "hip hop": ["Hip-Hop"],
  horrorcore: ["Hip-Hop"],
  "italian trap": ["Hip-Hop"],
  "j-rap": ["Hip-Hop"],
  "jazz rap": ["Hip-Hop", "Jazz"],
  "jersey club": ["Hip-Hop", "Electronic"],
  "melodic rap": ["Hip-Hop"],
  "new york drill": ["Hip-Hop"],
  "old school hip hop": ["Hip-Hop"],
  plunderphonics: ["Hip-Hop", "Electronic"],
  rap: ["Hip-Hop"],
  "rap québécois": ["Hip-Hop"],
  "sexy drill": ["Hip-Hop"],
  "southern hip hop": ["Hip-Hop"],
  trap: ["Hip-Hop"],
  "trap soul": ["Hip-Hop", "R&B/Soul"],
  "uk drill": ["Hip-Hop"],
  "uk grime": ["Hip-Hop"],
  "underground hip hop": ["Hip-Hop"],
  "west coast hip hop": ["Hip-Hop"],
  "french rap": ["Hip-Hop"],
  crunk: ["Hip-Hop"],
  "trap metal": ["Hip-Hop", "Metal"],
  "rap metal": ["Hip-Hop", "Metal"],
  "rap rock": ["Hip-Hop", "Rock"],

  // --- Rock ---
  "alternative rock": ["Rock"],
  "art rock": ["Rock"],
  "blues rock": ["Rock"],
  "classic rock": ["Rock"],
  "christian rock": ["Rock"],
  emo: ["Rock"],
  "garage rock": ["Rock"],
  "glam rock": ["Rock"],
  "gothic rock": ["Rock"],
  grunge: ["Rock"],
  "hard rock": ["Rock"],
  "indie rock": ["Rock"],
  "industrial rock": ["Rock"],
  "math rock": ["Rock"],
  "midwest emo": ["Rock"],
  "new wave": ["Rock"],
  "post-grunge": ["Rock"],
  "post-hardcore": ["Rock"],
  "post-punk": ["Rock"],
  "post-rock": ["Rock"],
  "psychedelic rock": ["Rock"],
  "acid rock": ["Rock"],
  "neo-psychedelic": ["Rock"],
  punk: ["Rock"],
  "pop punk": ["Rock"],
  screamo: ["Rock"],
  shoegaze: ["Rock"],
  "space rock": ["Rock"],
  "stoner rock": ["Rock", "Metal"],
  "surf rock": ["Rock"],
  "yacht rock": ["Rock"],
  "soft rock": ["Rock"],
  rock: ["Rock"],
  "indie dance": ["Rock", "Electronic"],
  "japanese indie": ["Rock"],
  "chinese indie": ["Rock"],
  "j-rock": ["Rock"],
  indie: ["Rock"],
  "noise rock": ["Rock"],

  // --- Metal ---
  "alternative metal": ["Metal"],
  "doom metal": ["Metal"],
  "drone metal": ["Metal"],
  "heavy metal": ["Metal"],
  metal: ["Metal"],
  "nu metal": ["Metal"],
  "progressive metal": ["Metal"],
  industrial: ["Metal", "Electronic"],

  // --- Jazz ---
  "acid jazz": ["Jazz"],
  bebop: ["Jazz"],
  "cool jazz": ["Jazz"],
  "experimental jazz": ["Jazz"],
  "free jazz": ["Jazz"],
  "hard bop": ["Jazz"],
  "indie jazz": ["Jazz"],
  jazz: ["Jazz"],
  "jazz ballads": ["Jazz"],
  "jazz beats": ["Jazz"],
  "jazz funk": ["Jazz", "R&B/Soul"],
  "jazz fusion": ["Jazz"],
  "jazz pop": ["Jazz", "Pop"],
  "nu jazz": ["Jazz"],
  "ambient jazz": ["Jazz", "Electronic"],
  "ethiopian jazz": ["Jazz"],
  "swing music": ["Jazz"],
  "big band": ["Jazz"],

  // --- R&B/Soul ---
  "alternative r&b": ["R&B/Soul"],
  "classic soul": ["R&B/Soul"],
  "contemporary r&b": ["R&B/Soul"],
  "dark r&b": ["R&B/Soul"],
  disco: ["R&B/Soul"],
  funk: ["R&B/Soul"],
  "indie soul": ["R&B/Soul"],
  "j-r&b": ["R&B/Soul"],
  motown: ["R&B/Soul"],
  "neo soul": ["R&B/Soul"],
  "northern soul": ["R&B/Soul"],
  "quiet storm": ["R&B/Soul"],
  "r&b": ["R&B/Soul"],
  "retro soul": ["R&B/Soul"],
  soul: ["R&B/Soul"],
  "uk r&b": ["R&B/Soul"],

  // --- Folk ---
  "ambient folk": ["Folk", "Electronic"],
  "anti-folk": ["Folk"],
  "indie folk": ["Folk"],
  "lo-fi": ["Folk"],
  "lo-fi beats": ["Folk", "Electronic"],
  "lo-fi indie": ["Folk"],
  neofolk: ["Folk"],
  "modern blues": ["Folk"],
  slowcore: ["Folk"],
  "spoken word": ["Folk"],
  "dream pop": ["Folk", "Pop"],
  "bedroom pop": ["Folk", "Pop"],

  // --- Electronic ---
  "afro house": ["Electronic"],
  ambient: ["Electronic"],
  "bass house": ["Electronic"],
  "baltimore club": ["Electronic"],
  breakcore: ["Electronic"],
  chillstep: ["Electronic"],
  darkwave: ["Electronic"],
  downtempo: ["Electronic"],
  "trip hop": ["Electronic", "Hip-Hop"],
  drone: ["Electronic"],
  drumstep: ["Electronic"],
  dub: ["Electronic", "Reggae"],
  edm: ["Electronic"],
  electroacoustic: ["Electronic"],
  electroclash: ["Electronic"],
  electronic: ["Electronic"],
  experimental: ["Electronic"],
  footwork: ["Electronic"],
  "g-house": ["Electronic"],
  glitch: ["Electronic"],
  "happy hardcore": ["Electronic"],
  hardstyle: ["Electronic"],
  hyperpop: ["Electronic", "Pop"],
  idm: ["Electronic"],
  "indie electronic": ["Electronic"],
  jungle: ["Electronic"],
  "musique concrète": ["Electronic"],
  "neue deutsche welle": ["Other"],
  "noise music": ["Electronic"],
  "progressive trance": ["Electronic"],
  psytrance: ["Electronic"],
  "rally house": ["Electronic"],
  synthpop: ["Electronic", "Pop"],
  synthwave: ["Electronic"],
  vaporwave: ["Electronic"],
  "witch house": ["Electronic"],
  "shibuya-kei": ["Electronic", "Pop"],

  // --- Pop ---
  "art pop": ["Pop"],
  "baroque pop": ["Pop"],
  "city pop": ["Pop"],
  "french pop": ["Pop"],
  "j-pop": ["Pop"],
  "moroccan pop": ["Pop"],
  musicals: ["Pop"],
  "soft pop": ["Pop"],

  // --- Reggae ---
  "lovers rock": ["Reggae"],
  ragga: ["Reggae"],
  reggae: ["Reggae"],
  rocksteady: ["Reggae"],
  "roots reggae": ["Reggae"],

  // --- Other (no clean fit in this taxonomy) ---
  anime: ["Other"],
  "avant-garde": ["Other"],
  bachata: ["Other"],
  cajun: ["Other"],
  christmas: ["Other"],
  exotica: ["Other"],
  kizomba: ["Other"],
  kompa: ["Other"],
  "música adventista": ["Other"],
  parang: ["Other"],
  raï: ["Other"],
  schlager: ["Other"],
  schlagerparty: ["Other"],
  "visual kei": ["Other"],
  zouk: ["Other"],
  zydeco: ["Other"],
};

/** Every major genre a track's tags touch, deduplicated. Empty if the track has no genre data. */
export function genresForTrack(genres: string[]): Genre[] {
  const result = new Set<Genre>();
  for (const tag of genres) {
    const mapped = MAP[tag];
    if (mapped) {
      for (const g of mapped) result.add(g);
    } else {
      result.add("Other");
    }
  }
  return Array.from(result);
}
