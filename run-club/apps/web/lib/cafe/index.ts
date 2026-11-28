/**
 * Higround Cafe Menu & Embeddable Playlist helpers (Roadmap v4 — Fase D).
 */
import rawMenu from "../../../../config/cafe_menu.json";

export interface CafeMenuItem {
  name: string;
  price: string;
  desc: string;
  tag?: "favourite" | "chef" | "barista" | "new";
}

export interface CafeMenuCategory {
  id: string;
  name: string;
  icon: string;
  note?: string;
  items: CafeMenuItem[];
}

export interface CafeMenuConfig {
  cafeName: string;
  location: string;
  tagline: string;
  googleMapsUrl: string;
  menuPdfUrl: string;
  defaultPlaylistUrl: string;
  categories: CafeMenuCategory[];
}

export const CAFE_MENU: CafeMenuConfig = rawMenu as CafeMenuConfig;

export interface PlaylistEmbed {
  provider: "spotify" | "youtube";
  embedUrl: string;
  openUrl: string;
  label: string;
}

/**
 * Convert a Spotify or YouTube playlist/track/video URL into a safe iframe embed URL.
 * Falls back to Higround's default playlist when the input is blank or invalid.
 */
export function resolvePlaylistEmbed(rawUrl?: string | null): PlaylistEmbed {
  const candidate = (rawUrl ?? "").trim() || CAFE_MENU.defaultPlaylistUrl;
  try {
    const u = new URL(candidate);
    const host = u.hostname.replace(/^www\./, "");

    // Spotify: https://open.spotify.com/playlist/<id> or /album/<id> or /track/<id>
    if (host === "open.spotify.com") {
      const cleanPath = u.pathname.replace(/^\/embed/, "");
      const m = cleanPath.match(/^\/(playlist|album|track)\/([A-Za-z0-9]+)/);
      if (m) {
        const [, kind, id] = m;
        return {
          provider: "spotify",
          embedUrl: `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`,
          openUrl: `https://open.spotify.com/${kind}/${id}`,
          label: "Spotify Playlist Higround",
        };
      }
    }

    // YouTube / YouTube Music playlist or video
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
      const list = u.searchParams.get("list");
      if (list && /^[A-Za-z0-9_-]+$/.test(list)) {
        return {
          provider: "youtube",
          embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`,
          openUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}`,
          label: "YouTube Playlist Higround",
        };
      }
      const vid = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
      if (vid && /^[A-Za-z0-9_-]{6,20}$/.test(vid)) {
        return {
          provider: "youtube",
          embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(vid)}`,
          openUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`,
          label: "YouTube BGM Higround",
        };
      }
    }
  } catch {
    // invalid URL -> fall back
  }

  return {
    provider: "spotify",
    embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0",
    openUrl: CAFE_MENU.defaultPlaylistUrl,
    label: "Spotify Playlist Higround",
  };
}
