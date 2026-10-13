# share-message-card.tsx — "A message for your WhatsApp group"

Shown by teacher-dashboard.tsx between the headline figures (`RepKpis`)
and the bar strip, only on the viewer's OWN unit one level in (`ownUnit`):
a teacher on their class (the level's id is their user id → audience
`parents`), an official on their own geo entity (a BEO on their block →
`teachers`). Never on a peer's unit or a school under their block, never at
the home level.

On every mount (and "Write it again") it fetches
`GET geo-entities/:id/share-message?viewer=` (pp-sketch
share-message.service.ts: a fresh Hindi message written by an LLM from the
unit's numbers; 403 for anyone but the owner; nothing cached or stored).
While loading, a skeleton at the text's height — the page never jumps. On
any failure (403, timeout, empty text) the card is not rendered at all.

Buttons: "Copy message" (clipboard; flips to "Copied — now paste it into
WhatsApp" for 2.5 s), "Open WhatsApp" (`wa.me/?text=…`, the share sheet on
a phone), "Write it again". The chrome follows the EN/हिं toggle; the
message itself is always Hindi.
