import { Home, ListMusic, Music, Radio } from "lucide-react";

/**
 * The app's destinations, in one place.
 *
 * Both the desktop sidebar and the mobile drawer render from this (ADR 0016),
 * so adding a destination means editing one array rather than remembering two.
 */
export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/musics", label: "Tracks", icon: Music, end: false },
  { to: "/playlists", label: "Playlists", icon: ListMusic, end: false },
  { to: "/rooms", label: "Rooms", icon: Radio, end: false },
] as const;

/** Shared link styling, so the two surfaces look like one app. */
export function navLinkClass(isActive: boolean): string {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;
}
