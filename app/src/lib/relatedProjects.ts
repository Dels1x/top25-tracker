/**
 * "Linked artist" identity - a softer, OPT-IN cousin of the always-on
 * identity rules baked into data.json at build time (misspelling correction,
 * alias merging, group->member expansion; see scripts/artistAttribution.ts).
 *
 * Those are certain: a misspelling is just wrong, a true alias is the exact
 * same legal artist. This table is a judgment call instead - two or more
 * credited names that are different projects/bands/credits but share the
 * same key person, where it can be useful to see that person's combined
 * output as one entry, while other people might reasonably want to keep
 * seeing each project counted separately. So this only applies when the
 * "Show linked artists" checkbox is on (see useLinkedArtists /
 * StatsOptions.showLinkedArtists in stats.ts) - unlike the build-time
 * tables, which are never optional.
 *
 * Unlike the old "unite similar artists/groups" mechanism this replaced,
 * turning this on does NOT replace/merge the original credited names - it
 * ADDS the linked person's name as an extra scoringArtist alongside
 * whichever of their projects actually appears on the track. With the
 * checkbox on, a Mount Eerie track keeps crediting "Mount Eerie" AND also
 * credits "Phil Elverum"; a Deftones track still credits "Deftones" on its
 * own (Phil Elverum/Chino Moreno aren't retroactively added to every track -
 * only the ones by a project actually listed as one of their entries below).
 * This means Leaderboard etc. can show both "Mount Eerie" and "The
 * Microphones" as their own distinct rows AND show "Phil Elverum" as a
 * combined entry totaling both - nothing is hidden, something is added.
 *
 * Current cases:
 * - "Phil Elverum": "Mount Eerie", "The Microphones" - his main recording
 *   project was renamed partway through his career.
 * - "Mark Kozelek": "Red House Painters", "Sun Kil Moon" - same
 *   singer-songwriter and primary creative voice, two successive full-band
 *   project names.
 * - "Chino Moreno": "Deftones", "Team Sleep" - Team Sleep is Chino Moreno's
 *   side project, sharing some Deftones members and his own frontperson role.
 * - "Hayley Williams": "Paramore" - she's Paramore's lead singer; this entry
 *   exists so a track where she's credited as a featured artist outside
 *   Paramore still rolls up into the same combined "Hayley Williams" total
 *   as her Paramore tracks.
 * - "Josh Homme": "Queens of the Stone Age", "Kyuss" - he founded/fronts
 *   Queens of the Stone Age and was a guitarist in Kyuss before that.
 * - "Zach Hill": "Team Sleep", "Death Grips" - drummer in both (also one of
 *   Death Grips' two core members) - this is the first case where a single
 *   credited name ("Team Sleep") legitimately belongs to two different
 *   linked entries at once (Chino Moreno's and Zach Hill's); a Team Sleep
 *   track adds BOTH combined names, it isn't an either/or choice.
 */
export const LINKED_ARTISTS: Record<string, string[]> = {
  "Phil Elverum": ["Mount Eerie", "The Microphones"],
  "Mark Kozelek": ["Red House Painters", "Sun Kil Moon"],
  "Chino Moreno": ["Deftones", "Team Sleep"],
  "Hayley Williams": ["Paramore"],
  "Josh Homme": ["Queens of the Stone Age", "Kyuss"],
  "Zach Hill": ["Team Sleep", "Death Grips"],
};

/**
 * Reverse lookup, built once: credited project/member name -> the linked
 * person name(s) it should ALSO credit when the "Show linked artists"
 * checkbox is on. A name can in principle belong to more than one linked
 * entry (none do today), so this maps to an array rather than assuming a
 * single owner.
 */
const LINKED_ARTISTS_BY_MEMBER: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [linkedName, members] of Object.entries(LINKED_ARTISTS)) {
    for (const member of members) {
      const existing = map.get(member);
      if (existing) existing.push(linkedName);
      else map.set(member, [linkedName]);
    }
  }
  return map;
})();

/** The linked person name(s) this credited name should ALSO add, if any. */
export function linkedArtistsFor(name: string): string[] {
  return LINKED_ARTISTS_BY_MEMBER.get(name) ?? [];
}
