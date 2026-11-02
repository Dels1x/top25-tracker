import { useAlbumArt } from "../lib/useAlbumArt";

interface AlbumArtProps {
  spotifyId: string | null;
  alt: string;
  className?: string;
}

/**
 * Renders nothing (not a placeholder box) when there's no spotifyId or the
 * oEmbed fetch hasn't resolved/failed - same "no broken image" convention as
 * every other spotifyId-gated bit of UI in this app. Callers that need the
 * layout slot to stay a fixed size regardless (e.g. a grid row) size it via
 * their own CSS on `className`, not here.
 */
export function AlbumArt({ spotifyId, alt, className }: AlbumArtProps) {
  const url = useAlbumArt(spotifyId);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
