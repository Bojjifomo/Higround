import { describe, expect, it } from "vitest";
import { CAFE_MENU, resolvePlaylistEmbed } from "./index";

describe("Higround Cafe Menu config", () => {
  it("loads official Higround categories, Google Maps link, and Menu PDF link", () => {
    expect(CAFE_MENU.categories.length).toBeGreaterThanOrEqual(8);
    expect(CAFE_MENU.googleMapsUrl).toContain("maps.app.goo.gl/zWJ7nExLghEzYQjm9");
    expect(CAFE_MENU.menuPdfUrl).toContain("1uxWolkAArosG4Nlxr2NGkjSPRFI3wUGa");
    const burgerCat = CAFE_MENU.categories.find((c) => c.id === "burger");
    expect(burgerCat?.items.some((i) => i.name === "The OG")).toBe(true);
  });
});

describe("resolvePlaylistEmbed", () => {
  it("converts Spotify playlist URLs into embed URLs", () => {
    const res = resolvePlaylistEmbed("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc");
    expect(res.provider).toBe("spotify");
    expect(res.embedUrl).toBe("https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0");
  });

  it("converts YouTube playlist URLs into embed URLs", () => {
    const res = resolvePlaylistEmbed("https://www.youtube.com/playlist?list=PL12345_abc");
    expect(res.provider).toBe("youtube");
    expect(res.embedUrl).toBe("https://www.youtube.com/embed/videoseries?list=PL12345_abc");
  });

  it("falls back safely to Higround's official playlist on empty or invalid URLs", () => {
    const res = resolvePlaylistEmbed("javascript:alert(1)");
    expect(res.provider).toBe("spotify");
    expect(res.embedUrl).toBe("https://open.spotify.com/embed/playlist/0DQmoeWhWcYx5luFiywcm3?utm_source=generator&theme=0");
  });
});
