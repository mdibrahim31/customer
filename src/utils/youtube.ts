/**
 * Extract YouTube Video ID from any standard YouTube URL (standard watch, youtu.be, shorts, embed)
 */
export function getYouTubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/;
  const match = trimmed.match(regExp);
  return match && match[1] ? match[1] : null;
}

/**
 * Generate an autoplay, loop, muted, control-less YouTube embed URL
 */
export function getYouTubeEmbedUrl(url: string | undefined | null): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0&cc_lang_pref=off`;
}

/**
 * Check if a URL points directly to a video file (.mp4, .webm, etc.)
 */
export function isDirectVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg') || clean.includes('.mp4?') || clean.includes('.webm?');
}

