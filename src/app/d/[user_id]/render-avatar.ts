// Server-only DiceBear rendering (Node 22+). Sprouts is DiceBear's "animated"
// style, but its `animation` component has a `none` variant (the only one with
// weight > 0) — forcing `animationVariant: ["none"]` yields a static SVG.
// Notionists is the fallback style the route also accepts.

import { Avatar, Style } from "@dicebear/core";
import sprouts from "@dicebear/styles/sprouts.json";
import notionists from "@dicebear/styles/notionists.json";
import type { AvatarStyle } from "./avatar";

const STYLES: Record<AvatarStyle, Style> = {
  sprouts: new Style(sprouts),
  notionists: new Style(notionists),
};

export function renderAvatarSvg(style: AvatarStyle, seed: string, size = 128): string {
  if (style === "sprouts") {
    return new Avatar(STYLES.sprouts, { seed, size, animationVariant: ["none"] }).toString();
  }
  return new Avatar(STYLES.notionists, { seed, size }).toString();
}
