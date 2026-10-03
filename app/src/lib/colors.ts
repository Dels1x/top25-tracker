/**
 * Categorical series colors, in fixed order. Per the dataviz color rule,
 * color must follow the ENTITY (the artist), never the entity's rank in a
 * filtered/sorted list - so we assign each artist a color once, the first
 * time we see them, and never reassign it when the visible set changes
 * (e.g. toggling other artists on/off).
 *
 * The first 8 slots are the validated, CVD-safe categorical palette (see the
 * dataviz skill) - reserved for the artists shown by default / most likely to
 * be compared side by side. This dataset can have far more than 8 distinct
 * artists though, and "everyone past #8 is grey" reads as broken, not
 * restrained. So artists beyond slot 8 get a procedurally generated hue
 * instead of a fallback neutral: evenly spaced around the color wheel using
 * the golden-angle increment (~137.5 deg), which avoids near-neighbors ever
 * landing on similar hues as more artists are added. These generated colors
 * don't carry the same CVD-safety guarantee as the validated 8 - fine here,
 * since with 9+ simultaneous series exact color-matching was already off the
 * table; the goal past that point is "visibly distinct," not "colorblind-safe
 * to the same bar."
 */
const SERIES_VARS = [
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
  "--series-6",
  "--series-7",
  "--series-8",
] as const;

const GOLDEN_ANGLE = 137.508;
/** Mid-range so the generated hue reads on both the light and dark surface. */
const GENERATED_SATURATION = 62;
const GENERATED_LIGHTNESS = 52;

export function cssVar(name: string): string {
  return `var(${name})`;
}

function generatedColor(overflowIndex: number): string {
  const hue = (overflowIndex * GOLDEN_ANGLE) % 360;
  return `hsl(${hue.toFixed(1)}, ${GENERATED_SATURATION}%, ${GENERATED_LIGHTNESS}%)`;
}

/**
 * Builds a stable artist -> CSS color map. `orderedArtists` should be a
 * stable ordering (e.g. by all-time total descending) so the same artist
 * gets the same slot/hue across renders as long as the ordering itself
 * doesn't change dramatically.
 */
export function buildArtistColorMap(orderedArtists: string[]): Map<string, string> {
  const map = new Map<string, string>();
  orderedArtists.forEach((artist, index) => {
    const slot = SERIES_VARS[index];
    map.set(artist, slot ? cssVar(slot) : generatedColor(index - SERIES_VARS.length));
  });
  return map;
}
