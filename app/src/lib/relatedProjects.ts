/**
 * "Related project" unification - a softer, OPT-IN cousin of the always-on
 * identity rules baked into data.json at build time (misspelling correction,
 * alias merging, group->member expansion; see scripts/artistAttribution.ts).
 *
 * Those are certain: a misspelling is just wrong, a true alias is the exact
 * same legal artist. This table is a judgment call instead - two or more
 * credited names that are different projects/entities but share enough
 * creative lineage (overlapping members, a shared frontperson) that it can
 * be useful to view them as one for scoring, while other people might
 * reasonably want to see them counted separately. So this merge only applies
 * when the "unite similar artists/groups" checkbox is on (see
 * useRelatedProjects / StatsOptions.uniteRelatedProjects in stats.ts) -
 * unlike the build-time tables, which are never optional.
 *
 * Current cases:
 * - "Mount Eerie" and "The Microphones" -> both collapse to "Phil Elverum",
 *   the person behind both - his main recording project was renamed
 *   partway through his career, so the project names themselves aren't
 *   interchangeable, but the person is. (Arguably closer to a true alias
 *   than the Team Sleep case below, but since the project NAME genuinely
 *   changed rather than just the artist's stage name, it's kept here as
 *   opt-in rather than forced like R.A.P. Ferreira/Milo.)
 * - "Team Sleep" -> "Deftones": different bands, not the same legal entity,
 *   but Team Sleep shares enough members (and its frontperson, Chino
 *   Moreno) with Deftones that uniting them under "Deftones" is a reasonable
 *   view of "how much Deftones-adjacent music is in here".
 */
export const RELATED_PROJECTS: Record<string, string> = {
  "Mount Eerie": "Phil Elverum",
  "The Microphones": "Phil Elverum",
  "Team Sleep": "Deftones",
};

export function uniteRelatedProject(name: string): string {
  return RELATED_PROJECTS[name] ?? name;
}
