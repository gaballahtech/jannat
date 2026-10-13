/* Product video links — paste a watch/share URL, we embed the player.
   Supported, easiest first:
   - YouTube: watch, youtu.be, Shorts, /embed, /live
   - TikTok: video links (/video/<id>, vm./vt. shorts need expanding — paste the full link)
   - Instagram: Reel / Post / TV  (embeds via instagram iframe endpoint)
   - Vimeo: vimeo.com/<id> and player links
   - Direct files: .mp4 / .webm / .mov (played with a native <video> tag)
   Anything else → null (admin shows which platforms work). */

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'vimeo' | 'direct';

export type ParsedVideo = {
  platform: VideoPlatform;
  /** Safe https embed/src URL for <iframe> or <video>. */
  embedUrl: string;
  /** Short label for the UI, e.g. "YouTube". */
  label: string;
  /** Original video id when the platform has one. */
  id?: string;
};

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;
const DIGITS = /^\d{5,25}$/;

function ytId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return YT_ID.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const p = url.pathname;
    if (p === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return YT_ID.test(id) ? id : null;
    }
    for (const prefix of ['/embed/', '/shorts/', '/live/', '/v/']) {
      if (p.startsWith(prefix)) {
        const id = p.slice(prefix.length).split('/').filter(Boolean)[0] ?? '';
        if (YT_ID.test(id)) return id;
      }
    }
  }
  return null;
}

function lastPathId(url: URL): string | null {
  const segs = url.pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1] ?? '';
  return DIGITS.test(last) ? last : null;
}

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const path = url.pathname.toLowerCase();

  const yt = ytId(url);
  if (yt) {
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
      label: 'YouTube',
      id: yt,
    };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const m = /\/video\/(\d{5,25})/.exec(url.pathname);
    const id = m ? m[1] : lastPathId(url);
    if (id) {
      return { platform: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${id}`, label: 'TikTok', id };
    }
    return null;
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    const m = /\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,30})/.exec(url.pathname);
    if (m) {
      return {
        platform: 'instagram',
        embedUrl: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed`,
        label: 'Instagram',
        id: m[2],
      };
    }
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = lastPathId(url);
    if (id) {
      return { platform: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}`, label: 'Vimeo', id };
    }
    return null;
  }
  if (/\.(mp4|webm|mov)(\?|#|$)/.test(path)) {
    return { platform: 'direct', embedUrl: url.toString(), label: 'Video' };
  }
  return null;
}

/** One-liner for admin validation + save guards. */
export function isValidVideoUrl(raw: string): boolean {
  return raw.trim() === '' || parseVideoUrl(raw) !== null;
}

export const VIDEO_HELP =
  'YouTube, TikTok, Instagram, Vimeo or a direct .mp4 link — paste the normal share URL, the player embeds itself.';
