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
  "Trap",
  "Jazz Rap",
  "Cloud Rap",
  "Boom Bap",
  "Conscious Hip-Hop",
  "Gangsta Rap",
  "Coke Rap",
  "Chipmunk Soul",
  "Rock",
  "Art Rock",
  "Indie Rock",
  "Alternative Rock",
  "Grunge",
  "Emo",
  "Neo-Psychedelia",
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
  "Math Rock",
  "Trip Hop",
  "Ambient",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];

/**
 * Every subgenre automatically also counts toward its parent major genre(s)
 * - an artist listed under "Dream Pop" should also show up under "Pop", an
 * artist listed under "Abstract Hip-Hop" should also show up under
 * "Hip-Hop", etc. This is applied automatically in genresForArtists, so an
 * ARTIST_GENRES entry only needs to list the MOST SPECIFIC genre(s) that
 * apply - never list both a subgenre and its parent by hand (e.g. just
 * ["Dream Pop"], not ["Dream Pop", "Pop"] - the parent is added for you).
 * Keep this map in sync whenever a new subgenre is added below.
 */
const PARENT_GENRE: Record<string, Genre[]> = {
  "East Coast Hip-Hop": ["Hip-Hop"],
  "West Coast Hip-Hop": ["Hip-Hop"],
  "Southern Hip-Hop": ["Hip-Hop"],
  "Abstract Hip-Hop": ["Hip-Hop"],
  "Experimental Hip-Hop": ["Hip-Hop"],
  "Trap": ["Hip-Hop"],
  "Jazz Rap": ["Hip-Hop"],
  "Cloud Rap": ["Hip-Hop"],
  "Boom Bap": ["Hip-Hop"],
  "Conscious Hip-Hop": ["Hip-Hop"],
  "Gangsta Rap": ["Hip-Hop"],
  "Coke Rap": ["Hip-Hop"],
  "Chipmunk Soul": ["Hip-Hop"],
  "Art Rock": ["Rock"],
  "Alternative Rock": ["Rock"],
  Grunge: ["Rock"],
  Emo: ["Rock"],
  "Neo-Psychedelia": ["Rock"],
  Shoegaze: ["Rock"],
  "Post-Rock": ["Rock"],
  "Math Rock": ["Rock"],
  "Indie Rock": ["Rock"],
  Slowcore: ["Rock"],
  "Trip Hop": ["Electronic"],
  Ambient: ["Electronic"],
  "Noise Pop": ["Pop"],
  "Dream Pop": ["Pop"],
  "Glitch Pop": ["Pop"],
  Indietronica: ["Electronic", "Pop"],
};

/** Shown for a track with no artist we can classify at all. */
export const UNTAGGED_GENRE = "Unknown/Untagged";

/**
 * Every top-level genre (one with no parent of its own - i.e. not a key in
 * PARENT_GENRE), in GENRES order, with the list of its direct subgenres (if
 * any), derived from PARENT_GENRE. Powers the Leaderboard's genre filter UI:
 * one checkbox per top-level genre, with its subgenres as an expandable
 * list of child checkboxes underneath. A genre with no subgenres (Jazz,
 * Metal, R&B/Soul, Reggae, Other, ...) just has an empty array - no
 * disclosure arrow needed for those in the UI.
 */
export const GENRE_HIERARCHY: Array<{ genre: string; subgenres: Genre[] }> = (() => {
  const childrenByParent = new Map<Genre, Genre[]>();
  for (const [sub, parents] of Object.entries(PARENT_GENRE) as Array<[Genre, Genre[]]>) {
    for (const p of parents) {
      const list = childrenByParent.get(p) ?? [];
      list.push(sub);
      childrenByParent.set(p, list);
    }
  }
  const isSubgenre = new Set(Object.keys(PARENT_GENRE));
  const topLevel = GENRES.filter((g) => !isSubgenre.has(g)).map((g) => ({
    genre: g,
    subgenres: childrenByParent.get(g) ?? [],
  }));
  // Unknown/Untagged isn't a real Genre (it's a separate fallback bucket for
  // tracks with no classifiable artist), but it's included here too so the
  // Leaderboard's genre filter can show/hide untagged artists the same way
  // as any other top-level genre, with no subgenres of its own.
  return [...topLevel, { genre: UNTAGGED_GENRE, subgenres: [] }];
})();

export const ARTIST_GENRES: Record<string, Genre[]> = {
  // ===== Hip-Hop (general / production-forward, no strong regional lean) =====
  "The Alchemist": ["Hip-Hop"],
  "Freddie Gibbs": ["Southern Hip-Hop", "Gangsta Rap", "Coke Rap", "Boom Bap", "Jazz Rap"],
  Madlib: ["Jazz Rap"],
  "Kill Bill: The Rapper": ["Hip-Hop", "Jazz Rap", "Abstract Hip-Hop"],
  "Nicholas Craven": ["Hip-Hop"],
  "Kenny Segal": ["Abstract Hip-Hop"],
  Nujabes: ["Jazz Rap"],
  "MF DOOM": ["Abstract Hip-Hop", "Experimental Hip-Hop", "East Coast Hip-Hop"],
  Madvillain: ["Abstract Hip-Hop"],
  Quasimoto: ["Abstract Hip-Hop"],
  "DJ Premier": ["East Coast Hip-Hop", "Boom Bap"],
  "Statik Selektah": ["East Coast Hip-Hop"],
  "Cookin Soul": ["Hip-Hop"],
  "Hit-Boy": ["Hip-Hop"],
  "Kenny Beats": ["Hip-Hop"],
  "No ID": ["Hip-Hop"],
  "Conductor Williams": ["East Coast Hip-Hop"],
  "Real Bad Man": ["Hip-Hop"],
  Evidence: ["West Coast Hip-Hop", "Abstract Hip-Hop"],
  "Black Milk": ["Abstract Hip-Hop"],
  "Swizz Beatz": ["East Coast Hip-Hop"],
  "DJ Muggs": ["West Coast Hip-Hop"],
  "Metro Boomin": ["Southern Hip-Hop"],
  "DJ Shadow": ["Hip-Hop", "Trip Hop"],
  Blockhead: ["Abstract Hip-Hop"],
  "Danger Mouse": ["Hip-Hop"],
  "J Dilla": ["Abstract Hip-Hop"],
  Futurewave: ["Hip-Hop"], // producer

  // ===== East Coast Hip-Hop =====
  "billy woods": ["Abstract Hip-Hop", "Experimental Hip-Hop", "East Coast Hip-Hop", "Jazz Rap"],
  "E L U C I D": ["Abstract Hip-Hop", "Experimental Hip-Hop", "East Coast Hip-Hop"],
  "Armand Hammer": ["Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Boldy James": ["East Coast Hip-Hop", "Jazz Rap", "Gangsta Rap"],
  "Roc Marciano": ["East Coast Hip-Hop", "Coke Rap", "Gangsta Rap"],
  Ka: ["East Coast Hip-Hop", "Abstract Hip-Hop", "Abstract Hip-Hop"],
  JPEGMAFIA: ["Experimental Hip-Hop"],
  "Westside Gunn": ["East Coast Hip-Hop", "Gangsta Rap", "Coke Rap"],
  "Mach-Hommy": ["East Coast Hip-Hop", "Abstract Hip-Hop", "Jazz Rap"],
  "Joey Bada$$": ["East Coast Hip-Hop", "Jazz Rap"],
  "Rome Streetz": ["East Coast Hip-Hop", "Gangsta Rap", "Coke Rap"],
  "Benny The Butcher": ["East Coast Hip-Hop", "Gangsta Rap", "Coke Rap"],
  "Conway the Machine": ["East Coast Hip-Hop", "Gangsta Rap", "Coke Rap"],
  Griselda: ["East Coast Hip-Hop", "Gangsta Rap", "Coke Rap"],
  "R.A.P. Ferreira": ["Abstract Hip-Hop", "Experimental Hip-Hop", "Jazz Rap"],
  "Aesop Rock": ["Abstract Hip-Hop", "East Coast Hip-Hop"],
  "El-P": ["Abstract Hip-Hop", "East Coast Hip-Hop", "Experimental Hip-Hop"],
  "Run The Jewels": ["East Coast Hip-Hop"],
  "Killer Mike": ["Southern Hip-Hop"],
  MIKE: ["Abstract Hip-Hop", "East Coast Hip-Hop", "Jazz Rap"],
  "Open Mike Eagle": ["Abstract Hip-Hop", "Jazz Rap", "West Coast Hip-Hop"],
  "AKAI SOLO": ["Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Navy Blue": ["Abstract Hip-Hop", "East Coast Hip-Hop", "Jazz Rap"],
  "Mos Def": ["East Coast Hip-Hop"],
  "Yasiin Bey": ["East Coast Hip-Hop"],
  "Talib Kweli": ["East Coast Hip-Hop"],
  "Black Star": ["East Coast Hip-Hop"],
  "A Tribe Called Quest": ["East Coast Hip-Hop", "Jazz Rap"],
  "Q-Tip": ["East Coast Hip-Hop", "Jazz Rap"],
  Shing02: ["Jazz Rap"],
  "Phife Dawg": ["East Coast Hip-Hop"],
  Raekwon: ["East Coast Hip-Hop", "Boom Bap"],
  "Ghostface Killah": ["East Coast Hip-Hop", "Boom Bap"],
  "Wu-Tang Clan": ["East Coast Hip-Hop", "Boom Bap"],
  RZA: ["East Coast Hip-Hop", "Boom Bap"],
  GZA: ["East Coast Hip-Hop", "Boom Bap"],
  Cappadonna: ["East Coast Hip-Hop"],
  "Killah Priest": ["East Coast Hip-Hop"],
  CZARFACE: ["East Coast Hip-Hop"],
  "Method Man": ["East Coast Hip-Hop"],
  Redman: ["East Coast Hip-Hop"],
  EPMD: ["East Coast Hip-Hop"],
  "Mobb Deep": ["East Coast Hip-Hop", "Boom Bap"],
  Prodigy: ["East Coast Hip-Hop", "Boom Bap"],
  Havoc: ["East Coast Hip-Hop", "Boom Bap"],
  "Big Noyd": ["East Coast Hip-Hop", "Boom Bap"],
  "Big L": ["East Coast Hip-Hop", "Boom Bap"],
  "Shabazz Palaces": ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  "Sean Price": ["Boom Bap", "East Coast Hip-Hop"],
  "Gang Starr": ["East Coast Hip-Hop", "Boom Bap"],
  Guru: ["East Coast Hip-Hop", "Boom Bap"],
  "Black Thought": ["East Coast Hip-Hop", "Conscious Hip-Hop", "Jazz Rap"],
  "The Roots": ["East Coast Hip-Hop", "Jazz Rap"],
  "The Notorious B.I.G.": ["East Coast Hip-Hop", "Boom Bap", "Gangsta Rap"],
  AZ: ["East Coast Hip-Hop"],
  "Big Pun": ["East Coast Hip-Hop", "Boom Bap"],
  Nas: ["East Coast Hip-Hop", "Boom Bap"],
  "JAŸ-Z": ["East Coast Hip-Hop", "Coke Rap", "Gangsta Rap"],
  "Slick Rick": ["East Coast Hip-Hop", "Boom Bap"],
  "Your Old Droog": ["East Coast Hip-Hop"],
  "Fly Anakin": ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  "Estee Nack": ["East Coast Hip-Hop", "Experimental Hip-Hop", "Gangsta Rap"],
  "Dr. Yen Lo": ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  PremRock: ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  ShrapKnel: ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  "38 Spesh": ["East Coast Hip-Hop", "Gangsta Rap"],
  "Tha God Fahim": ["East Coast Hip-Hop"],
  "Stove God Cooks": ["East Coast Hip-Hop", "Gangsta Rap", "Coke Rap"],
  "Tee Grizzley": ["Hip-Hop", "Trap", "Gangsta Rap"],
  "King Von": ["Hip-Hop", "Trap", "Gangsta Rap"],
  "Lil Durk": ["Hip-Hop", "Trap", "Gangsta Rap"],
  "Teller Bank$": ["Experimental Hip-Hop", "Abstract Hip-Hop", "Jazz Rap"],
  "Kirk Knight": ["East Coast Hip-Hop"],
  "Nightmargin": ["Ambient"],
  "what is your name?": ["Shoegaze", "Post-Rock", "Indie Rock"],
  "CJ Fly": ["East Coast Hip-Hop"],
  "Chuck Strangers": ["East Coast Hip-Hop"],
  "Dyemond Lewis": ["East Coast Hip-Hop"],
  "T'nah Apex": ["East Coast Hip-Hop"],
  "A-F-R-O": ["Boom Bap"],
  "Aaron May": ["Jazz Rap"],
  "Boards of Canada": ["Ambient"],
  "Joey Valance & Brae": ["Experimental Hip-Hop", "Boom Bap"],
  "Force Of Nature": ["Jazz Rap"],
  "Roland Johnson": ["Hip-Hop"],
  Despot: ["East Coast Hip-Hop"],
  "Homeboy Sandman": ["Abstract Hip-Hop", "East Coast Hip-Hop"],
  Wiki: ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  "Quelle Chris": ["Abstract Hip-Hop"],
  Jadakiss: ["East Coast Hip-Hop"],
  "Fat Joe": ["East Coast Hip-Hop"],
  "Young Dolph": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "Key Glock": ["Southern Hip-Hop", "Trap"],
  Lukah: ["Abstract Hip-Hop", "Southern Hip-Hop"],
  "Little Brother": ["East Coast Hip-Hop", "Boom Bap"],
  Phonte: ["East Coast Hip-Hop", "R&B/Soul"],
  "9th Wonder": ["East Coast Hip-Hop"],
  "Pete Rock": ["East Coast Hip-Hop", "Jazz Rap", "Boom Bap"],
  "Count Bass D": ["East Coast Hip-Hop"],
  "Black Moon": ["East Coast Hip-Hop", "Boom Bap"],
  "Smif-N-Wessun": ["East Coast Hip-Hop", "Boom Bap"],
  "MC Eiht": ["West Coast Hip-Hop", "Gangsta Rap"],
  Maxo: ["Abstract Hip-Hop"],
  Cavalier: ["Abstract Hip-Hop", "East Coast Hip-Hop"],
  "Moor Mother": ["Abstract Hip-Hop"],
  "Mike Ladd": ["Abstract Hip-Hop"],
  "Pink Siifu": ["Abstract Hip-Hop"],
  "al.divino": ["East Coast Hip-Hop", "Abstract Hip-Hop", "Experimental Hip-Hop", "Gangsta Rap"],
  "Gabe 'Nandez": ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  Preservation: ["Abstract Hip-Hop"],
  "Hermit and the Recluse": ["East Coast Hip-Hop", "Abstract Hip-Hop"],
  Ransom: ["East Coast Hip-Hop", "Gangsta Rap", "Jazz Rap", "Boom Bap"],
  "Big Ghost Ltd": ["East Coast Hip-Hop", "Gangsta Rap"],
  "Willie The Kid": ["East Coast Hip-Hop"],
  Clipse: ["East Coast Hip-Hop", "Coke Rap", "Gangsta Rap"],
  "Pusha T": ["East Coast Hip-Hop", "Coke Rap", "Gangsta Rap"],
  Malice: ["East Coast Hip-Hop", "Coke Rap", "Gangsta Rap"],
  "Planet Asia": ["West Coast Hip-Hop"],
  "Durag Dynasty": ["West Coast Hip-Hop"],
  Tristate: ["West Coast Hip-Hop"],
  "Killer Ben": ["West Coast Hip-Hop"],

  // ===== West Coast Hip-Hop =====
  "Kendrick Lamar": ["West Coast Hip-Hop", "Jazz Rap"],
  "Dr. Dre": ["West Coast Hip-Hop", "Gangsta Rap"],
  Xzibit: ["West Coast Hip-Hop", "Gangsta Rap"],
  "Snoop Dogg": ["West Coast Hip-Hop", "Gangsta Rap"],
  "Kanye West": ["Chipmunk Soul"],
  "Kid Cudi": ["Hip-Hop"],
  "KIDS SEE GHOSTS": ["Hip-Hop"], // duo: Kanye West + Kid Cudi
  "A$AP Rocky": ["Hip-Hop", "Cloud Rap", "Trap"],
  "ScHoolboy Q": ["West Coast Hip-Hop", "Trap", "Gangsta Rap"],
  "Vince Staples": ["West Coast Hip-Hop", "Jazz Rap"],
  "Earl Sweatshirt": ["Abstract Hip-Hop", "Jazz Rap", "Experimental Hip-Hop"],
  "Tyler, The Creator": ["Hip-Hop"],
  Logic: ["Hip-Hop", "Jazz Rap"],
  "Domo Genesis": ["West Coast Hip-Hop"],
  "Denzel Curry": ["Southern Hip-Hop", "Trap"],
  "Mac Miller": ["Hip-Hop", "Jazz Rap"],
  "Jay Rock": ["West Coast Hip-Hop"],
  "Ab-Soul": ["West Coast Hip-Hop"],
  "Isaiah Rashad": ["Southern Hip-Hop", "Jazz Rap"],
  "Baby Keem": ["West Coast Hip-Hop"],
  "Jay Worthy": ["West Coast Hip-Hop", "Gangsta Rap"],
  MED: ["West Coast Hip-Hop", "Abstract Hip-Hop"],
  Blu: ["West Coast Hip-Hop", "Abstract Hip-Hop", "Jazz Rap"],
  Exile: ["West Coast Hip-Hop", "Abstract Hip-Hop", "Jazz Rap"],
  "Blu & Exile": ["West Coast Hip-Hop", "Abstract Hip-Hop", "Jazz Rap"],
  "2Pac": ["West Coast Hip-Hop", "Gangsta Rap"],
  "Oh No": ["West Coast Hip-Hop", "Abstract Hip-Hop"],
  "Travis Scott": ["Southern Hip-Hop", "Trap"],
  Problem: ["West Coast Hip-Hop"],

  // ===== Southern Hip-Hop =====
  Outkast: ["Southern Hip-Hop"],
  "Big Boi": ["Southern Hip-Hop"],
  "André 3000": ["Southern Hip-Hop"],
  "J. Cole": ["Hip-Hop"],
  "Lupe Fiasco": ["Abstract Hip-Hop", "Jazz Rap"],
  "Big K.R.I.T.": ["Southern Hip-Hop"],
  "Curren$y": ["Southern Hip-Hop", "Jazz Rap", "Gangsta Rap"],
  "Larry June": ["West Coast Hip-Hop", "Jazz Rap", "Trap", "Gangsta Rap"],
  "Action Bronson": ["East Coast Hip-Hop"],
  "Action Bronson & Alchemist": ["East Coast Hip-Hop"],
  "EST Gee": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "Big Sean": ["Hip-Hop"],
  "Future": ["Southern Hip-Hop", "Trap"],
  "Gucci Mane": ["Southern Hip-Hop", "Trap"],
  "Young Thug": ["Southern Hip-Hop", "Trap"],
  "Juicy J": ["Southern Hip-Hop", "Trap"],
  "Polo G": ["Hip-Hop", "Trap", "Gangsta Rap"],
  "Pooh Shiesty": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "Booka600": ["Southern Hip-Hop", "Trap"],
  "Lil Yachty": ["Southern Hip-Hop", "Trap"],
  "Doodie Lo": ["Southern Hip-Hop", "Trap"],
  "Only The Family": ["Southern Hip-Hop", "Trap"],
  "21 Savage": ["Southern Hip-Hop", "Trap"],
  Bas: ["Hip-Hop"],
  EARTHGANG: ["Southern Hip-Hop", "Trap"],
  "Young Dro": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "BIG30": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "King Chip": ["Southern Hip-Hop"],
  "Rick Ross": ["Southern Hip-Hop", "Coke Rap"],
  "Lil Baby": ["Southern Hip-Hop", "Trap"],
  "Lil Wayne": ["Southern Hip-Hop", "Trap"],
  "T.I.": ["Southern Hip-Hop"],
  "Hotboii": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "NLE Choppa": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "Moneybagg Yo": ["Southern Hip-Hop", "Trap", "Gangsta Rap"],
  "Chief Keef": ["Hip-Hop", "Trap"],
  "Lil Reese": ["Hip-Hop", "Trap"],
  "BigWalkDog": ["Southern Hip-Hop", "Trap"],
  "Sheck Wes": ["Hip-Hop", "Trap"],
  "DJ Khaled": ["Southern Hip-Hop"],
  "Wiz Khalifa": ["Hip-Hop"],
  "Marshmello": ["Electronic"],
  "50 Cent": ["East Coast Hip-Hop"],
  "Lloyd Banks": ["East Coast Hip-Hop"],
  "B.o.B": ["Southern Hip-Hop"],

  // ===== Abstract / experimental hip-hop (no strong region) =====
  "clipping.": ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  "Daveed Diggs": ["Abstract Hip-Hop"],
  "Death Grips": ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  BUSDRIVER: ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  "Moka Only": ["Abstract Hip-Hop"],
  "Serengeti": ["Abstract Hip-Hop"],
  cropscropscrops: ["Abstract Hip-Hop"],
  Vaygrnt: ["Abstract Hip-Hop"],
  "Niontay": ["Abstract Hip-Hop"],
  "redveil": ["Experimental Hip-Hop"],
  "McKinley Dixon": ["Abstract Hip-Hop", "Jazz Rap"],
  "Sampha": ["R&B/Soul", "Electronic"],
  "Quadeca": ["Indietronica"],
  "IDK": ["Hip-Hop", "Trap"],
  "MAVI": ["Abstract Hip-Hop", "Jazz Rap"],
  "Saba": ["Jazz Rap"],
  "Smino": ["Hip-Hop", "R&B/Soul"],
  "Lute": ["Southern Hip-Hop"],
  "Spillage Village": ["Southern Hip-Hop"],
  "Little Simz": ["Abstract Hip-Hop"],
  "slowthai": ["Hip-Hop"],
  "Dreamville": ["Hip-Hop"],

  // ===== Rap/metal/rock crossover acts (own entry, not major-genre inferred) =====
  "JID": ["Southern Hip-Hop", "Trap"],
  "Joyner Lucas": ["Hip-Hop"],
  "Eminem": ["East Coast Hip-Hop"],
  "Bad Meets Evil": ["East Coast Hip-Hop"],
  "Royce Da 5'9\"": ["Hip-Hop", "East Coast Hip-Hop"],
  "Danny Brown": ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  "Cities Aviv": ["Abstract Hip-Hop", "Experimental Hip-Hop", "Cloud Rap"],
  "Injury Reserve": ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  heavensouls: ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  Stickerbush: ["Abstract Hip-Hop", "Experimental Hip-Hop"],
  "Yelawolf": ["Southern Hip-Hop"],
  "Cordae": ["Hip-Hop"],
  "Drake": ["Hip-Hop", "Trap"],
  "Common": ["East Coast Hip-Hop", "Jazz Rap"],
  "2 Chainz": ["Southern Hip-Hop", "Trap"],
  "Pharrell Williams": ["Hip-Hop", "R&B/Soul"],
  "Busta Rhymes": ["East Coast Hip-Hop"],
  "A$AP Ferg": ["East Coast Hip-Hop"],
  "Lil B": ["West Coast Hip-Hop", "Cloud Rap"],
  "Slum Village": ["Abstract Hip-Hop", "Jazz Rap"],
  "The Pharcyde": ["West Coast Hip-Hop", "Abstract Hip-Hop", "Jazz Rap"],
  "De La Soul": ["East Coast Hip-Hop", "Jazz Rap"],
  "B-Real": ["West Coast Hip-Hop"],
  Eve: ["East Coast Hip-Hop"],
  "Central Cee": ["Hip-Hop", "Trap"],
  "Capital Steez": ["East Coast Hip-Hop"],
  Oxxxymiron: ["Conscious Hip-Hop"],
  Rav: ["Abstract Hip-Hop", "Jazz Rap"], // "lo-fi hip-hop" per user, same bucket as Kill Bill: The Rapper
  Scuare: ["Abstract Hip-Hop", "Jazz Rap"], // same as Rav per user
  "Charles Hamilton": ["Chipmunk Soul"],
  "Jonathan Snipes": ["Abstract Hip-Hop"],
  "Slava KPSS": ["Abstract Hip-Hop"],
  Blackchai: ["Abstract Hip-Hop"],
  "Ba Pace": ["Abstract Hip-Hop"],
  "Messiah Musik": ["Hip-Hop"], // producer
  "Controller 7": ["Hip-Hop"], // producer
  "William Hutson": ["Abstract Hip-Hop"],
  "Nickelus F": ["Boom Bap", "Abstract Hip-Hop"],
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
  "Uyama Hiroto": ["Jazz Rap"],
  "Sterling Toles": ["Jazz Rap", "Abstract Hip-Hop"],

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
  "Queens of the Stone Age": ["Art Rock", "Alternative Rock"],
  "Radiohead": ["Alternative Rock", "Art Rock"],
  Failure: ["Alternative Rock", "Grunge"],
  "The Rolling Stones": ["Rock"],
  "Paramore": ["Rock"],
  "The Doors": ["Rock"],
  "U2": ["Rock"],
  "Elton John": ["Rock", "Pop"],
  "Frank Ocean": ["R&B/Soul"],
  "Phoebe Bridgers": ["Rock", "Folk"],
  "Rex Orange County": ["Pop", "R&B/Soul"],
  "Bon Iver": ["Folk", "Rock"],
  "Jack White": ["Rock"],
  "Benjamin Booker": ["Art Rock"],
  "kessoku band": ["Rock"], // j-rock, per user
  "Ichiko Aoba": ["Folk"],
  "Taeko Onuki": ["Pop"],

  // ===== Metal =====
  "Black Sabbath": ["Metal", "Rock"],
  Deftones: ["Metal", "Shoegaze"],
  "Loathe": ["Metal", "Shoegaze"],
  "Team Sleep": ["Metal", "Shoegaze"],
  "Swans": ["Post-Rock"],
  "Robin Callaway": ["Shoegaze", "Post-Rock"],
  "Foals": ["Indie Rock"],
  "bôa": ["Alternative Rock", "Indie Rock"],

  // ===== Shoegaze / Slowcore / Post-Rock / Ambient family =====
  "The Microphones": ["Folk", "Rock"],
  "Mount Eerie": ["Folk", "Rock"],
  "Phil Elverum": ["Folk", "Rock"],
  Slowdive: ["Shoegaze"],
  "my bloody valentine": ["Shoegaze"],
  "Beach House": ["Shoegaze", "Pop"],
  Panchiko: ["Shoegaze", "Indie Rock"],
  "Red House Painters": ["Slowcore", "Post-Rock"],
  "Have A Nice Life": ["Shoegaze", "Post-Rock"],
  Slint: ["Post-Rock", "Math Rock"],
  "Godspeed You Black Emperor!": ["Post-Rock", "Ambient"],
  "Natural Snow Buildings": ["Ambient", "Folk"],
  "Sweet Trip": ["Shoegaze", "Electronic"],
  "Della Zyr": ["Shoegaze", "Dream Pop"],
  Fishmans: ["Neo-Psychedelia", "Dream Pop", "Post-Rock"],
  "Newfound Interest in Connecticut": ["Emo", "Post-Rock"],
  "On The Might Of Princes": ["Emo", "Post-Rock"],

  // ===== Trip Hop / downtempo / electronic =====
  "Massive Attack": ["Trip Hop"],
  Portishead: ["Trip Hop"],
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
  "Nate Dogg": ["R&B/Soul", "West Coast Hip-Hop"],
};

/**
 * Given a track's resolved scoringArtists, returns every genre any of them
 * are classified under, PLUS every parent genre implied by PARENT_GENRE
 * (deduplicated) - so an ARTIST_GENRES entry only ever needs to list the
 * most specific genre(s), never the parent too. Returns [UNTAGGED_GENRE] if
 * none of the credited/scoring artists are in ARTIST_GENRES at all.
 */
export function genresForArtists(scoringArtists: string[]): string[] {
  const result = new Set<string>();
  for (const artist of scoringArtists) {
    const genres = ARTIST_GENRES[artist];
    if (!genres) continue;
    for (const g of genres) {
      result.add(g);
      const parents = PARENT_GENRE[g];
      if (parents) {
        for (const p of parents) result.add(p);
      }
    }
  }
  if (result.size === 0) return [UNTAGGED_GENRE];
  return Array.from(result);
}
