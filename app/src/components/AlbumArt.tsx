import { useAlbumArt } from "../lib/useAlbumArt";
import styles from "./AlbumArt.module.css";

interface AlbumArtProps {
  spotifyId: string | null;
  alt: string;
  className?: string;
}

/**
 * A generic "no cover art" placeholder - shown for a local file
 * (spotify:local:..., no spotifyId at all) or a track whose oEmbed fetch
 * failed/returned nothing (network error, since-removed track, transient
 * rate limit - see useAlbumArt's own doc comment). Inline SVG rather than a
 * static asset file so it themes correctly via the existing CSS custom
 * properties in both light and dark mode, same convention the rest of this
 * app's iconography follows (no image assets anywhere else in src/).
 */
function AlbumArtPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`${styles.placeholder} ${className ?? ""}`} role="img" aria-label="No cover art">
      <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" aria-hidden="true">
        <path
          d="M9 18V5l12-2v13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

/**
 * Fixed-size slot either way (real art or the placeholder), so callers never
 * need to special-case layout for the missing-art case - the className they
 * pass for sizing applies to both branches.
 */
export function AlbumArt({ spotifyId, alt, className }: AlbumArtProps) {
  const url = useAlbumArt(spotifyId);
  if (!url) return <AlbumArtPlaceholder className={className} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
