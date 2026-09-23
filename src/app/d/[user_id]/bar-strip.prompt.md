# bar-strip.tsx — the bars under the map card

Port of mvp2's `BarGraph` (the ranked-bar strip under the map on every
level). `BarStrip({ items, max, hoverId, setHoverId, selId, onClick, hint, t })`:
a 150 px white strip (`rounded-b-2xl`, the map card above loses its bottom
radius) with one flex bar per `BarItem = { id, name, sub, value, display,
color }`, sorted by value desc; height = value / `max` (2 % minimum), colour =
the item's tile/marker colour, grey `#e5e7eb` when `value` is null (not using
Lifteracy / unscored). Header line: "{count} · {hint}" left, "hover a bar for
details" right. Hover: sets the page's `hoverId` (so map marker, trend line and
bar light up together), dims the others to 0.45, and — only when the hover
started on a bar (`localHover`) — shows the card above it: name, `sub`, the
`display` value on the item colour, "Rank #i of n". Click → `onClick(item)`
(geo levels: `select`; class: open the student modal). No drag range / send
list (mvp2's messaging features are not on the dashboard).

teacher-dashboard.tsx builds `items` from `geoChildren` (pass rate,
`binColor(bin)`, sub = "{role_title} · {official}") or, in the class view,
from `students` (score % / minutes for usage, `nipColor` / `usageColor`);
`max` = 100, or the minutes axis (multiple of 10 ≥ 30) for usage in the
class view. `data-testid="bar-strip"` / `"bar"` (`data-id`, `data-hot`) /
`"bar-card"`; the wrapper is `"bar-strip-wrap"` and sits between the map card
and the share bar.
