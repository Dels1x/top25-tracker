import { useEffect, useState } from "react";

/**
 * Album art thumbnails via Spotify's public oEmbed endpoint
 * (https://open.spotify.com/oembed?url=spotify:track:<id>) - no API
 * credentials needed, same trust level as the existing SpotifyEmbed
 * <iframe> in Replay.tsx/Top25Fight.tsx, which already talks to
 * open.spotify.com directly at runtime with no backend involved. The CSV
 * export/Track type has no cover-art URL of its own, only spotifyId, so this
 * has to be a runtime fetch rather than something baked into data.json at
 * build time.
 *
 * Cached two ways so the same track is never refetched:
 * - An in-memory Map, shared across every useAlbumArt call in the page
 *   (module-level, not per-component-instance) - the same track often shows
 *   up in multiple places at once (a Leaderboard drill-down row AND that
 *   artist's other months), and definitely across re-renders.
 * - localStorage, so a returning visitor doesn't re-fetch every track in
 *   their history on every page load either. Cover art URLs are effectively
 *   permanent, so there's no need to ever invalidate/expire an entry.
 *
 * A failed fetch (network error, 404 for a since-removed track, rate limit)
 * caches `null` too - rather than retrying every render - so a broken ID
 * doesn't turn into a request storm; the caller just renders no art for it.
 */
const STORAGE_KEY = "top25tracker:albumArtCache";
const memoryCache = new Map<string, string | null>();
let storageLoaded = false;
let pending = new Map<string, Promise<string | null>>();

function loadStorageCache() {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string | null>;
      for (const [id, url] of Object.entries(obj)) {
        if (!memoryCache.has(id)) memoryCache.set(id, url);
      }
    }
  } catch {
    // ignore (private browsing, corrupted value, etc.)
  }
}

function persistToStorage() {
  try {
    const obj: Record<string, string | null> = {};
    for (const [id, url] of memoryCache) obj[id] = url;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore - e.g. storage quota exceeded with a large cache; the
    // in-memory cache still works fine for the rest of this session
  }
}

async function fetchAlbumArt(spotifyId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=spotify:track:${spotifyId}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the album art URL for a track's spotifyId, or null while loading /
 * unavailable (no spotifyId, fetch failed, or not on Spotify at all) - the
 * caller should render nothing (no broken image) in the null case rather
 * than a placeholder, same as every other "no spotifyId" fallback in this
 * app (e.g. Replay's preview button).
 */
export function useAlbumArt(spotifyId: string | null): string | null {
  loadStorageCache();
  const cached = spotifyId ? memoryCache.get(spotifyId) ?? null : null;
  const [fetched, setFetched] = useState<string | null>(cached);

  useEffect(() => {
    if (!spotifyId || memoryCache.has(spotifyId)) return;
    let cancelled = false;
    let request = pending.get(spotifyId);
    if (!request) {
      request = fetchAlbumArt(spotifyId);
      pending.set(spotifyId, request);
    }
    request.then((result) => {
      pending.delete(spotifyId);
      memoryCache.set(spotifyId, result);
      persistToStorage();
      if (!cancelled) setFetched(result);
    });
    return () => {
      cancelled = true;
    };
  }, [spotifyId]);

  // `cached` wins once the id is in the cache (covers the already-cached
  // case on mount, and a spotifyId change to another already-cached id
  // without waiting for the effect) - `fetched` only matters for the one
  // id this effect run is actually fetching.
  return spotifyId && memoryCache.has(spotifyId) ? cached : fetched;
}
