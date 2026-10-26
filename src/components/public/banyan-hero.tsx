import { SiteHeader } from "./site-header";

/** Deterministic pseudo-random so server and client render the same roots. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function AerialRoots() {
  const rand = seeded(42);
  const roots = Array.from({ length: 46 }, (_, i) => {
    const x = 8 + i * 13 + rand() * 6;
    const len = 90 + rand() * 330;
    const sway = (rand() - 0.5) * 18;
    const width = 0.8 + rand() * 1.6;
    // Each root runs its own endless grow → hold → fade cycle. A negative delay starts it mid-cycle,
    // so the hero is already alive on load and roots keep dropping at different moments forever.
    const duration = 6 + rand() * 6;
    const delay = -rand() * duration;
    const swayDuration = 7 + rand() * 5;
    return { x, len, sway, width, duration, delay, swayDuration, tip: rand() > 0.55 };
  });
  return (
    <svg
      aria-hidden
      viewBox="0 0 620 460"
      preserveAspectRatio="xMidYMin slice"
      className="banyan-roots pointer-events-none absolute inset-y-0 right-0 h-full w-full opacity-35 [mask-image:linear-gradient(to_right,transparent,black_22%)] md:w-[58%] md:opacity-100"
    >
      <path d="M0 0H620V26C540 44 470 34 400 40C320 47 250 30 170 38C100 45 50 36 0 42Z" fill="#2b6158" />
      {roots.map((r, i) => (
        <g
          key={i}
          className="root"
          style={{ "--dur": `${r.duration}s`, "--delay": `${r.delay}s`, "--sway": `${r.swayDuration}s` } as React.CSSProperties}
        >
          <path
            d={`M${r.x} 30 C ${r.x + r.sway} ${30 + r.len * 0.4}, ${r.x - r.sway} ${30 + r.len * 0.7}, ${r.x + r.sway / 2} ${30 + r.len}`}
            stroke={i % 7 === 0 ? "#9cc3b9" : "#4d8077"}
            strokeWidth={r.width}
            strokeLinecap="round"
            fill="none"
            pathLength={1}
          />
          {r.tip && <circle cx={r.x + r.sway / 2} cy={30 + r.len} r={r.width + 0.6} fill="#9cc3b9" />}
        </g>
      ))}
      <style>{`
        .banyan-roots .root {
          transform-box: fill-box;
          transform-origin: 50% 0;
          animation: root-sway var(--sway) ease-in-out var(--delay) infinite alternate;
        }
        .banyan-roots .root path {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: root-grow var(--dur) cubic-bezier(.35,.6,.3,1) var(--delay) infinite;
        }
        .banyan-roots .root circle {
          opacity: 0;
          animation: root-tip var(--dur) ease-out var(--delay) infinite;
        }
        @keyframes root-grow {
          0%   { stroke-dashoffset: 1; opacity: 0; }
          6%   { opacity: 1; }
          50%  { stroke-dashoffset: 0; }
          78%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes root-tip {
          0%, 48% { opacity: 0; }
          56%, 78% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes root-sway {
          from { transform: rotate(-0.8deg); }
          to   { transform: rotate(0.8deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .banyan-roots .root, .banyan-roots .root path, .banyan-roots .root circle { animation: none; }
          .banyan-roots .root path { stroke-dashoffset: 0; }
          .banyan-roots .root circle { opacity: 1; }
        }
      `}</style>
    </svg>
  );
}

export function BanyanHero({ openCount }: { openCount: number }) {
  return (
    <section className="relative isolate overflow-hidden bg-canopy text-[#f1f5f3]">
      <SiteHeader overlay />
      <AerialRoots />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-36 sm:px-6 md:pb-28 md:pt-44">
        <div className="max-w-xl">
          <h1 className="text-[2.75rem] leading-[1.05] font-normal sm:text-6xl md:text-[4.25rem]" style={{ fontVariationSettings: '"SOFT" 100, "WONK" 0' }}>
            Build Your Career With Us
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#cde0db]">
            A banyan grows by sending down new roots. We grow the same way: through people who take hold, put in the work, and stay to see a community take shape.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href="#openings" className="inline-flex h-12 items-center rounded-md bg-[#f3f7f5] px-6 text-base font-semibold text-canopy hover:bg-white">
              See open positions
            </a>
            <span className="text-sm text-[#b3cbc5]">
              {openCount === 0 ? "No openings right now" : `${openCount} ${openCount === 1 ? "role" : "roles"} open today`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
