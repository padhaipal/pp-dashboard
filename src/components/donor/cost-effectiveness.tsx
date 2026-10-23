// The donor page's cost-effectiveness figures, under What LIFTeracy Does:
// LIFTeracy's estimated $31 per income doubling against Ambitious Impact's
// $60 funding bar as two bars to scale, the sentence with both sources, and
// the randomized-trial caveat as a small footnote.

const CEM_LINK = "https://claude.ai/artifact/Kxii4TUevmNLubo2WqygFx";
const AIM_BAR_LINK = "https://research.ambitiousimpact.com/ambitious-impact-eval/evaluative-criteria";

const BARS: { id: string; label: string; usd: number; href: string; fill: string }[] = [
  { id: "cost-lifteracy", label: "LIFTeracy, estimated at scale", usd: 31, href: CEM_LINK, fill: "bg-brand" },
  { id: "cost-aim-bar", label: "Ambitious Impact’s funding bar", usd: 60, href: AIM_BAR_LINK, fill: "bg-zinc-300" },
];
const MAX_USD = 60;

const linkCls = "font-semibold text-brand-ink underline decoration-brand-mute underline-offset-2 transition-colors hover:text-brand-deep";

export function CostEffectiveness() {
  return (
    <div className="max-w-3xl" data-testid="cost-effectiveness">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cost per income doubling</div>
      <div className="space-y-2.5">
        {BARS.map((b) => (
          <a key={b.id} href={b.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3" data-testid={b.id}>
            <span className="w-14 shrink-0 text-right text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">${b.usd}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-zinc-700 group-hover:underline">{b.label}</span>
              <span className={"mt-1 block h-3 rounded-full " + b.fill} style={{ width: `${(b.usd / MAX_USD) * 100}%` }} />
            </span>
          </a>
        ))}
      </div>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700">
        LIFTeracy is estimated to cost{" "}
        <a href={CEM_LINK} target="_blank" rel="noreferrer" className={linkCls}>
          $31 per income doubling at scale
        </a>
        , beating{" "}
        <a href={AIM_BAR_LINK} target="_blank" rel="noreferrer" className={linkCls}>
          Ambitious Impact’s funding bar of $60
        </a>
        .
      </p>
      <p className="mt-1 text-sm text-zinc-500">This estimate needs to be tested with a randomized control trial.</p>
    </div>
  );
}
