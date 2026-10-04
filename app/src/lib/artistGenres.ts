/**
 * Genre classification by ARTIST, not by Spotify's genre tags.
 *
 * Why: Spotify's per-track genre tags (see the old genreParents.ts, now
 * replaced by this file) turned out to be unreliable for this dataset -
 * tags like "jazz rap"/"plunderphonics"/"experimental" were applied as
 * loose vibe-descriptors for ~any sample-heavy or abstract hip-hop, not
 * because the track has real jazz/electronic content. Classifying by
 * ARTIST instead is more stable: an artist's genre doesn't flicker track
 * to track the way a crowd-sourced tag does, and it's something a person
 * who actually knows the artist can just state directly.
 *
 * ARTIST_GENRES maps a canonical artist name (matched against
 * `scoringArtists` - i.e. AFTER alias/misspelling/group-member resolution,
 * so use the canonical spelling, not a raw CSV credit) to the genre(s)
 * they work in. A track's genre set is the UNION of every scoringArtist's
 * genres - so a track by a hip-hop/rock crossover artist, or a
 * collaboration between a metal artist and a rapper, naturally lands in
 * both. An artist can legitimately have more than one genre (e.g. Phil
 * Elverum -> Folk AND Rock across his two projects; Deftones -> Metal AND
 * Shoegaze) - this is NOT a mistake to clean up, it's accurate.
 *
 * This is NOT exhaustive and NOT 100% precise - deliberately so. It only
 * covers artists this dataset's own listeners actually recognize, built by
 * going through the real artist list ordered by song count (most songs
 * first) and classifying everyone confidently known, leaving genuinely
 * unknown artists unmapped (-> UNTAGGED_GENRE, same bucket as a track with
 * no classifiable artist at all) rather than guessing. Covers the
 * overwhelming majority of total song-points in the dataset by design
 * (classifying by frequency means a small artist list covers most plays).
 *
 * Maintenance: add new artists here as they're spotted, highest-song-count
 * first. If an artist isn't recognized, leave them out rather than guess -
 * ask instead. Subgenres (e.g. "Abstract Hip-Hop", "East Coast Hip-Hop")
 * are listed ADDITIVELY alongside the major genre, never instead of it -
 * an artist with a subgenre still also counts toward the plain major genre
 * (billy woods -> both "Hip-Hop" and "Abstract Hip-Hop").
 */

export const GENRES = [
  "Hip-Hop",
  "East Coast Hip-Hop",
  "West Coast Hip-Hop",
  "Southern Hip-Hop",
  "Abstract Hip-Hop",
  "Experimental Hip-Hop",
  "Conscious Hip-Hop",
  "Chipmunk Soul",
  "Rock",
  "Art Rock",
  "Metal",
  "Jazz",
  "R&B/Soul",
  "Folk",
  "Electronic",
  "Pop",
  "Noise Pop",
  "Dream Pop",
  "Glitch Pop",
  "Indietronica",
  "Reggae",
  "Shoegaze",
  "Slowcore",
  "Post-Rock",
  "Trip Hop",
  "Ambient",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];

/** Shown for a track with no artist we can classify at all. */
export const UNTAGGED_GENRE = "Unknown/Untagged";

export const ARTIST_GENRES: Record<string, Genre[]> = {
  // ===== Hip-Hop (general / production-forward, no strong regional lean) =====
  "The Alchemist": ["Hip-Hop"],
  "Freddie Gibbs": ["Hip-Hop", "Southern Hip-Hop"],
  Madlib: ["Hip-Hop", "Jazz"],
  "Kill Bill: The Rapper": ["Hip-Hop"],
  "Nicholas Craven": ["Hip-Hop"],
  "Kenny Segal": ["Hip-Hop", "Abstract Hip-Hop"],
  Nujabes: ["Hip-Hop", "Jazz"],
  "MF DOOM": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  Madvillain: ["Hip-Hop", "Abstract Hip-Hop"],
  Quasimoto: ["Hip-Hop", "Abstract Hip-Hop"],
  "DJ Premier": ["Hip-Hop", "East Coast Hip-Hop"],
  "Statik Selektah": ["Hip-Hop", "East Coast Hip-Hop"],
  "Cookin Soul": ["Hip-Hop"],
  "Hit-Boy": ["Hip-Hop"],
  "Kenny Beats": ["Hip-Hop"],
  "No ID": ["Hip-Hop"],
  "Conductor Williams": ["Hip-Hop", "East Coast Hip-Hop"],
  "Real Bad Man": ["Hip-Hop"],
  Evidence: ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  "Black Milk": ["Hip-Hop", "Abstract Hip-Hop"],
  "Swizz Beatz": ["Hip-Hop", "East Coast Hip-Hop"],
  "DJ Muggs": ["Hip-Hop", "West Coast Hip-Hop"],
  "Metro Boomin": ["Hip-Hop", "Southern Hip-Hop"],
  "DJ Shadow": ["Hip-Hop", "Trip Hop", "Electronic"],
  Blockhead: ["Hip-Hop", "Abstract Hip-Hop"],
  "Danger Mouse": ["Hip-Hop"],
  "J Dilla": ["Hip-Hop", "Abstract Hip-Hop"],
  Futurewave: ["Hip-Hop"], // producer

  // ===== East Coast Hip-Hop =====
  "billy woods": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "E L U C I D": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Armand Hammer": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Boldy James": ["Hip-Hop", "East Coast Hip-Hop"],
  "Roc Marciano": ["Hip-Hop", "East Coast Hip-Hop"],
  Ka: ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  JPEGMAFIA: ["Hip-Hop", "Abstract Hip-Hop", "Electronic"],
  "Westside Gunn": ["Hip-Hop", "East Coast Hip-Hop"],
  "Mach-Hommy": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  "Joey Bada$$": ["Hip-Hop", "East Coast Hip-Hop"],
  "Rome Streetz": ["Hip-Hop", "East Coast Hip-Hop"],
  "Benny The Butcher": ["Hip-Hop", "East Coast Hip-Hop"],
  "Conway the Machine": ["Hip-Hop", "East Coast Hip-Hop"],
  Griselda: ["Hip-Hop", "East Coast Hip-Hop"],
  "R.A.P. Ferreira": ["Hip-Hop", "Abstract Hip-Hop"],
  "Aesop Rock": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "El-P": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Run The Jewels": ["Hip-Hop", "East Coast Hip-Hop"],
  "Killer Mike": ["Hip-Hop", "Southern Hip-Hop"],
  MIKE: ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Open Mike Eagle": ["Hip-Hop", "Abstract Hip-Hop"],
  "AKAI SOLO": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Navy Blue": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Mos Def": ["Hip-Hop", "East Coast Hip-Hop"],
  "Yasiin Bey": ["Hip-Hop", "East Coast Hip-Hop"],
  "Talib Kweli": ["Hip-Hop", "East Coast Hip-Hop"],
  "Black Star": ["Hip-Hop", "East Coast Hip-Hop"],
  "A Tribe Called Quest": ["Hip-Hop", "East Coast Hip-Hop", "Jazz"],
  "Q-Tip": ["Hip-Hop", "East Coast Hip-Hop", "Jazz"],
  Shing02: ["Hip-Hop", "Jazz"],
  "Phife Dawg": ["Hip-Hop", "East Coast Hip-Hop"],
  Raekwon: ["Hip-Hop", "East Coast Hip-Hop"],
  "Ghostface Killah": ["Hip-Hop", "East Coast Hip-Hop"],
  "Wu-Tang Clan": ["Hip-Hop", "East Coast Hip-Hop"],
  RZA: ["Hip-Hop", "East Coast Hip-Hop"],
  GZA: ["Hip-Hop", "East Coast Hip-Hop"],
  Cappadonna: ["Hip-Hop", "East Coast Hip-Hop"],
  "Killah Priest": ["Hip-Hop", "East Coast Hip-Hop"],
  CZARFACE: ["Hip-Hop", "East Coast Hip-Hop"],
  "Method Man": ["Hip-Hop", "East Coast Hip-Hop"],
  Redman: ["Hip-Hop", "East Coast Hip-Hop"],
  EPMD: ["Hip-Hop", "East Coast Hip-Hop"],
  "Mobb Deep": ["Hip-Hop", "East Coast Hip-Hop"],
  Prodigy: ["Hip-Hop", "East Coast Hip-Hop"],
  Havoc: ["Hip-Hop", "East Coast Hip-Hop"],
  "Big Noyd": ["Hip-Hop", "East Coast Hip-Hop"],
  "Gang Starr": ["Hip-Hop", "East Coast Hip-Hop"],
  Guru: ["Hip-Hop", "East Coast Hip-Hop"],
  "Black Thought": ["Hip-Hop", "East Coast Hip-Hop"],
  "The Roots": ["Hip-Hop", "East Coast Hip-Hop"],
  "The Notorious B.I.G.": ["Hip-Hop", "East Coast Hip-Hop"],
  AZ: ["Hip-Hop", "East Coast Hip-Hop"],
  "Big Pun": ["Hip-Hop", "East Coast Hip-Hop"],
  Nas: ["Hip-Hop", "East Coast Hip-Hop"],
  "JAŸ-Z": ["Hip-Hop", "East Coast Hip-Hop"],
  "Slick Rick": ["Hip-Hop", "East Coast Hip-Hop"],
  "Your Old Droog": ["Hip-Hop", "East Coast Hip-Hop"],
  "Fly Anakin": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  "Estee Nack": ["Hip-Hop", "East Coast Hip-Hop"],
  "Dr. Yen Lo": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  PremRock: ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  ShrapKnel: ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  "38 Spesh": ["Hip-Hop", "East Coast Hip-Hop"],
  "Tha God Fahim": ["Hip-Hop", "East Coast Hip-Hop"],
  "Stove God Cooks": ["Hip-Hop", "East Coast Hip-Hop"],
  "Tee Grizzley": ["Hip-Hop"],
  "King Von": ["Hip-Hop"],
  "Lil Durk": ["Hip-Hop"],
  "Kirk Knight": ["Hip-Hop", "East Coast Hip-Hop"],
  "CJ Fly": ["Hip-Hop", "East Coast Hip-Hop"],
  "Chuck Strangers": ["Hip-Hop", "East Coast Hip-Hop"],
  "Dyemond Lewis": ["Hip-Hop", "East Coast Hip-Hop"],
  "T'nah Apex": ["Hip-Hop", "East Coast Hip-Hop"],
  Despot: ["Hip-Hop", "East Coast Hip-Hop"],
  "Homeboy Sandman": ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  Wiki: ["Hip-Hop", "East Coast Hip-Hop"],
  "Quelle Chris": ["Hip-Hop", "Abstract Hip-Hop"],
  Jadakiss: ["Hip-Hop", "East Coast Hip-Hop"],
  "Fat Joe": ["Hip-Hop", "East Coast Hip-Hop"],
  "Young Dolph": ["Hip-Hop", "Southern Hip-Hop"],
  "Key Glock": ["Hip-Hop", "Southern Hip-Hop"],
  Lukah: ["Hip-Hop", "Abstract Hip-Hop", "Southern Hip-Hop"],
  "Little Brother": ["Hip-Hop", "East Coast Hip-Hop"],
  Phonte: ["Hip-Hop", "East Coast Hip-Hop", "R&B/Soul"],
  "9th Wonder": ["Hip-Hop", "East Coast Hip-Hop"],
  "Pete Rock": ["Hip-Hop", "East Coast Hip-Hop"],
  "Count Bass D": ["Hip-Hop", "East Coast Hip-Hop"],
  "Black Moon": ["Hip-Hop", "East Coast Hip-Hop"],
  "Smif-N-Wessun": ["Hip-Hop", "East Coast Hip-Hop"],
  "MC Eiht": ["Hip-Hop", "West Coast Hip-Hop"],
  Maxo: ["Hip-Hop", "Abstract Hip-Hop"],
  Cavalier: ["Hip-Hop", "Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Moor Mother": ["Hip-Hop", "Abstract Hip-Hop"],
  "Mike Ladd": ["Hip-Hop", "Abstract Hip-Hop"],
  "Pink Siifu": ["Hip-Hop", "Abstract Hip-Hop"],
  "Al.Divino": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  "al.divino": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  "Gabe 'Nandez": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  Preservation: ["Hip-Hop", "Abstract Hip-Hop"],
  "Hermit and the Recluse": ["Hip-Hop", "East Coast Hip-Hop", "Abstract Hip-Hop"],
  Ransom: ["Hip-Hop", "East Coast Hip-Hop"],
  "Big Ghost Ltd": ["Hip-Hop", "East Coast Hip-Hop"],
  "Willie The Kid": ["Hip-Hop", "East Coast Hip-Hop"],
  Clipse: ["Hip-Hop", "East Coast Hip-Hop"],
  "Pusha T": ["Hip-Hop", "East Coast Hip-Hop"],
  Malice: ["Hip-Hop", "East Coast Hip-Hop"],
  "Planet Asia": ["Hip-Hop", "West Coast Hip-Hop"],
  "Durag Dynasty": ["Hip-Hop", "West Coast Hip-Hop"],
  Tristate: ["Hip-Hop", "West Coast Hip-Hop"],
  "Killer Ben": ["Hip-Hop", "West Coast Hip-Hop"],

  // ===== West Coast Hip-Hop =====
  "Kendrick Lamar": ["Hip-Hop", "West Coast Hip-Hop"],
  "Dr. Dre": ["Hip-Hop", "West Coast Hip-Hop"],
  Xzibit: ["Hip-Hop", "West Coast Hip-Hop"],
  "Snoop Dogg": ["Hip-Hop", "West Coast Hip-Hop"],
  "Kanye West": ["Hip-Hop", "Chipmunk Soul"],
  "Kid Cudi": ["Hip-Hop"],
  "A$AP Rocky": ["Hip-Hop"],
  "ScHoolboy Q": ["Hip-Hop", "West Coast Hip-Hop"],
  "Vince Staples": ["Hip-Hop", "West Coast Hip-Hop"],
  "Earl Sweatshirt": ["Hip-Hop", "Abstract Hip-Hop"],
  "Tyler, The Creator": ["Hip-Hop"],
  Logic: ["Hip-Hop"],
  "Domo Genesis": ["Hip-Hop", "West Coast Hip-Hop"],
  "Denzel Curry": ["Hip-Hop"],
  "Mac Miller": ["Hip-Hop"],
  "Jay Rock": ["Hip-Hop", "West Coast Hip-Hop"],
  "Ab-Soul": ["Hip-Hop", "West Coast Hip-Hop"],
  "Isaiah Rashad": ["Hip-Hop", "Southern Hip-Hop"],
  "Baby Keem": ["Hip-Hop", "West Coast Hip-Hop"],
  "Jay Worthy": ["Hip-Hop", "West Coast Hip-Hop"],
  MED: ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  Blu: ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  Exile: ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  "Blu & Exile": ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  "2Pac": ["Hip-Hop", "West Coast Hip-Hop"],
  "Oh No": ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  "Travis Scott": ["Hip-Hop", "Southern Hip-Hop"],
  Problem: ["Hip-Hop", "West Coast Hip-Hop"],

  // ===== Southern Hip-Hop =====
  Outkast: ["Hip-Hop", "Southern Hip-Hop"],
  "Big Boi": ["Hip-Hop", "Southern Hip-Hop"],
  "André 3000": ["Hip-Hop", "Southern Hip-Hop", "Abstract Hip-Hop"],
  "J. Cole": ["Hip-Hop"],
  "Lupe Fiasco": ["Hip-Hop", "Abstract Hip-Hop"],
  "Big K.R.I.T.": ["Hip-Hop", "Southern Hip-Hop"],
  "Curren$y": ["Hip-Hop", "Southern Hip-Hop"],
  "Larry June": ["Hip-Hop", "West Coast Hip-Hop"],
  "Action Bronson": ["Hip-Hop", "East Coast Hip-Hop"],
  "Action Bronson & Alchemist": ["Hip-Hop", "East Coast Hip-Hop"],
  "EST Gee": ["Hip-Hop", "Southern Hip-Hop"],
  "Big Sean": ["Hip-Hop"],
  "Future": ["Hip-Hop", "Southern Hip-Hop"],
  "Gucci Mane": ["Hip-Hop", "Southern Hip-Hop"],
  "Young Thug": ["Hip-Hop", "Southern Hip-Hop"],
  "Juicy J": ["Hip-Hop", "Southern Hip-Hop"],
  "Polo G": ["Hip-Hop"],
  "Pooh Shiesty": ["Hip-Hop", "Southern Hip-Hop"],
  "Booka600": ["Hip-Hop", "Southern Hip-Hop"],
  "Lil Yachty": ["Hip-Hop", "Southern Hip-Hop"],
  "Doodie Lo": ["Hip-Hop", "Southern Hip-Hop"],
  "Only The Family": ["Hip-Hop", "Southern Hip-Hop"],
  "21 Savage": ["Hip-Hop", "Southern Hip-Hop"],
  Bas: ["Hip-Hop"],
  EARTHGANG: ["Hip-Hop", "Southern Hip-Hop"],
  "Young Dro": ["Hip-Hop", "Southern Hip-Hop"],
  "BIG30": ["Hip-Hop", "Southern Hip-Hop"],
  "King Chip": ["Hip-Hop", "Southern Hip-Hop"],
  "Rick Ross": ["Hip-Hop", "Southern Hip-Hop"],
  "Lil Baby": ["Hip-Hop", "Southern Hip-Hop"],
  "Lil Wayne": ["Hip-Hop", "Southern Hip-Hop"],
  "T.I.": ["Hip-Hop", "Southern Hip-Hop"],
  "Hotboii": ["Hip-Hop", "Southern Hip-Hop"],
  "NLE Choppa": ["Hip-Hop", "Southern Hip-Hop"],
  "Moneybagg Yo": ["Hip-Hop", "Southern Hip-Hop"],
  "Chief Keef": ["Hip-Hop"],
  "Lil Reese": ["Hip-Hop"],
  "BigWalkDog": ["Hip-Hop", "Southern Hip-Hop"],
  "Sheck Wes": ["Hip-Hop"],
  "DJ Khaled": ["Hip-Hop", "Southern Hip-Hop"],
  "Wiz Khalifa": ["Hip-Hop"],
  "Marshmello": ["Electronic"],
  "50 Cent": ["Hip-Hop", "East Coast Hip-Hop"],
  "Lloyd Banks": ["Hip-Hop", "East Coast Hip-Hop"],
  "B.o.B": ["Hip-Hop", "Southern Hip-Hop"],

  // ===== Abstract / experimental hip-hop (no strong region) =====
  "clipping.": ["Hip-Hop", "Abstract Hip-Hop"],
  "Daveed Diggs": ["Hip-Hop", "Abstract Hip-Hop"],
  "Death Grips": ["Hip-Hop", "Abstract Hip-Hop", "Electronic"],
  BUSDRIVER: ["Hip-Hop", "Abstract Hip-Hop"],
  "Moka Only": ["Hip-Hop", "Abstract Hip-Hop"],
  "Serengeti": ["Hip-Hop", "Abstract Hip-Hop"],
  cropscropscrops: ["Hip-Hop", "Abstract Hip-Hop"],
  Vaygrnt: ["Hip-Hop", "Abstract Hip-Hop"],
  "Niontay": ["Hip-Hop", "Abstract Hip-Hop"],
  "redveil": ["Hip-Hop", "Abstract Hip-Hop"],
  "McKinley Dixon": ["Hip-Hop", "Abstract Hip-Hop"],
  "Sampha": ["R&B/Soul", "Electronic"],
  "Quadeca": ["Hip-Hop", "Abstract Hip-Hop"],
  "IDK": ["Hip-Hop"],
  "MAVI": ["Hip-Hop", "Abstract Hip-Hop"],
  "Saba": ["Hip-Hop", "Abstract Hip-Hop"],
  "Smino": ["Hip-Hop", "R&B/Soul"],
  "Lute": ["Hip-Hop", "Southern Hip-Hop"],
  "Spillage Village": ["Hip-Hop", "Southern Hip-Hop"],
  "Little Simz": ["Hip-Hop", "Abstract Hip-Hop"],
  "slowthai": ["Hip-Hop"],
  "Dreamville": ["Hip-Hop"],

  // ===== Rap/metal/rock crossover acts (own entry, not major-genre inferred) =====
  "JID": ["Hip-Hop", "Southern Hip-Hop"],
  "Joyner Lucas": ["Hip-Hop"],
  "Eminem": ["Hip-Hop", "East Coast Hip-Hop"],
  "Bad Meets Evil": ["Hip-Hop", "East Coast Hip-Hop"],
  "Royce Da 5'9\"": ["Hip-Hop", "East Coast Hip-Hop"],
  "Danny Brown": ["Hip-Hop", "Abstract Hip-Hop"],
  "Cities Aviv": ["Hip-Hop", "Abstract Hip-Hop"],
  "Injury Reserve": ["Hip-Hop", "Abstract Hip-Hop", "Electronic"],
  "Yelawolf": ["Hip-Hop", "Southern Hip-Hop"],
  "Cordae": ["Hip-Hop"],
  "Drake": ["Hip-Hop"],
  "Common": ["Hip-Hop", "East Coast Hip-Hop"],
  "2 Chainz": ["Hip-Hop", "Southern Hip-Hop"],
  "Pharrell Williams": ["Hip-Hop", "R&B/Soul"],
  "Busta Rhymes": ["Hip-Hop", "East Coast Hip-Hop"],
  "A$AP Ferg": ["Hip-Hop", "East Coast Hip-Hop"],
  "Lil B": ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  "Slum Village": ["Hip-Hop", "Abstract Hip-Hop"],
  "The Pharcyde": ["Hip-Hop", "West Coast Hip-Hop", "Abstract Hip-Hop"],
  "B-Real": ["Hip-Hop", "West Coast Hip-Hop"],
  Eve: ["Hip-Hop", "East Coast Hip-Hop"],
  "Central Cee": ["Hip-Hop"],
  "Capital Steez": ["Hip-Hop", "East Coast Hip-Hop"],
  Oxxxymiron: ["Hip-Hop", "Conscious Hip-Hop"],
  Rav: ["Hip-Hop", "Abstract Hip-Hop"], // "lo-fi hip-hop" per user, same bucket as Kill Bill: The Rapper
  Scuare: ["Hip-Hop", "Abstract Hip-Hop"], // same as Rav per user
  "Charles Hamilton": ["Hip-Hop", "Chipmunk Soul"],
  "Jonathan Snipes": ["Hip-Hop", "Abstract Hip-Hop"],
  "William Hutson": ["Hip-Hop", "Abstract Hip-Hop"],
  "Jane Remover": [
    "Experimental Hip-Hop",
    "Noise Pop",
    "Indietronica",
    "Dream Pop",
    "Glitch Pop",
  ],

  // ===== Jazz =====
  "Robert Glasper": ["Jazz", "R&B/Soul"],
  "Miles Davis": ["Jazz"],
  "Yusef Lateef": ["Jazz"],
  "John Coltrane": ["Jazz"],
  "Bill Evans": ["Jazz"],
  "Ryo Fukui": ["Jazz"],
  "Thundercat": ["Jazz", "R&B/Soul", "Electronic"],
  "Shabaka Hutchings": ["Jazz"],
  "Uyama Hiroto": ["Jazz", "Hip-Hop"],
  "Sterling Toles": ["Jazz", "Hip-Hop", "Abstract Hip-Hop"],

  // ===== R&B / Soul =====
  "Erykah Badu": ["R&B/Soul"],
  "Jill Scott": ["R&B/Soul"],
  "John Legend": ["R&B/Soul"],
  "Marvin Gaye": ["R&B/Soul"],
  "Dwele": ["R&B/Soul"],
  "Anderson .Paak": ["R&B/Soul", "Hip-Hop"],
  "SZA": ["R&B/Soul"],
  "Kelela": ["R&B/Soul", "Electronic"],
  "Kali Uchis": ["R&B/Soul", "Pop"],
  "Bilal": ["R&B/Soul"],
  "BJ The Chicago Kid": ["R&B/Soul"],
  "Chrisette Michele": ["R&B/Soul"],
  "Ms. Lauryn Hill": ["R&B/Soul", "Hip-Hop"],
  "Goapele": ["R&B/Soul"],
  MINMI: ["R&B/Soul"],
  "Free Nationals": ["R&B/Soul", "Hip-Hop"],
  "6LACK": ["R&B/Soul"],
  "Esthero": ["R&B/Soul", "Trip Hop"],
  "Ari Lennox": ["R&B/Soul"],
  "Anna Wise": ["R&B/Soul"],

  // ===== Rock =====
  "Queens of the Stone Age": ["Rock", "Art Rock"],
  "Radiohead": ["Rock"],
  "Paramore": ["Rock"],
  "The Doors": ["Rock"],
  "U2": ["Rock"],
  "Elton John": ["Rock", "Pop"],
  "Frank Ocean": ["R&B/Soul"],
  "Phoebe Bridgers": ["Rock", "Folk"],
  "Rex Orange County": ["Pop", "R&B/Soul"],
  "Bon Iver": ["Folk", "Rock"],
  "Jack White": ["Rock"],
  "Benjamin Booker": ["Rock", "Art Rock"],
  "kessoku band": ["Rock"], // j-rock, per user
  "Ichiko Aoba": ["Folk"],
  "Taeko Onuki": ["Pop"],

  // ===== Metal =====
  "Black Sabbath": ["Metal", "Rock"],
  Deftones: ["Metal", "Shoegaze"],
  "Team Sleep": ["Metal", "Shoegaze"],

  // ===== Shoegaze / Slowcore / Post-Rock / Ambient family =====
  "The Microphones": ["Folk", "Rock"],
  "Mount Eerie": ["Folk", "Rock"],
  "Phil Elverum": ["Folk", "Rock"],
  Slowdive: ["Shoegaze"],
  "my bloody valentine": ["Shoegaze"],
  "Beach House": ["Shoegaze", "Pop"],
  Panchiko: ["Shoegaze", "Slowcore"],
  "Red House Painters": ["Slowcore", "Folk"],
  "Have A Nice Life": ["Slowcore", "Ambient", "Post-Rock"],
  Slint: ["Post-Rock", "Rock"],
  "Godspeed You Black Emperor!": ["Post-Rock", "Ambient"],
  "Natural Snow Buildings": ["Ambient", "Folk"],
  "NSB Archive": ["Ambient", "Folk"],
  "Sweet Trip": ["Shoegaze", "Electronic"],

  // ===== Trip Hop / downtempo / electronic =====
  "Massive Attack": ["Trip Hop", "Electronic"],
  Portishead: ["Trip Hop", "Electronic"],
  "Flying Lotus": ["Electronic", "Hip-Hop"],
  KAYTRANADA: ["Electronic", "R&B/Soul"],
  "The Avalanches": ["Electronic", "Pop"],
  "100 gecs": ["Electronic", "Pop"],
  "underscores": ["Electronic", "Pop"],
  "Kero Kero Bonito": ["Pop", "Electronic"],
  "Magdalena Bay": ["Pop", "Electronic"],
  "Depeche Mode": ["Electronic", "Pop", "Rock"],

  // ===== Pop / misc =====
  "Billie Essco": ["Pop"],
  "Norah Jones": ["Jazz", "Pop"],
  "Michael Kiwanuka": ["Folk", "R&B/Soul"],
  "Lucy Rose": ["Folk", "Pop"],
  "M.I.A.": ["Pop", "Hip-Hop"],
  "Chris Brown": ["R&B/Soul"],
  "Nate Dogg": ["R&B/Soul", "Hip-Hop", "West Coast Hip-Hop"],
};

/**
 * Given a track's resolved scoringArtists, returns every genre any of them
 * are classified under (deduplicated). Returns [UNTAGGED_GENRE] if none of
 * the credited/scoring artists are in ARTIST_GENRES at all.
 */
export function genresForArtists(scoringArtists: string[]): string[] {
  const result = new Set<string>();
  for (const artist of scoringArtists) {
    const genres = ARTIST_GENRES[artist];
    if (genres) {
      for (const g of genres) result.add(g);
    }
  }
  if (result.size === 0) return [UNTAGGED_GENRE];
  return Array.from(result);
}
