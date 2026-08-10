import { COLORS } from "@/lib/theme";

export function Card({ children, style }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, ...style }}
    >
      {children}
    </div>
  );
}

export function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="px-3 py-1.5 rounded-full text-sm transition-colors"
      style={{
        border: `1px solid ${active ? COLORS.accent : COLORS.line}`,
        background: active ? COLORS.accent : "transparent",
        color: active ? "#fff" : COLORS.ink,
      }}
    >
      {children}
    </button>
  );
}

function moonSvgPath(frac, r = 44) {
  const theta = frac * 2 * Math.PI;
  const rx = Math.abs(r * Math.cos(theta));
  const wax = frac < 0.5;
  const outerSweep = wax ? 1 : 0;
  const innerSweep = frac < 0.25 || frac > 0.75 ? outerSweep : 1 - outerSweep;
  return `M ${r},0 A ${r},${r} 0 0 ${outerSweep} ${r},${2 * r} A ${rx},${r} 0 0 ${innerSweep} ${r},0 Z`;
}

export function MoonGlyph({ frac, size = 88 }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={r} cy={r} r={r - 1} fill={COLORS.accentDeep} opacity="0.18" />
      <g transform={`translate(${size * 0.14}, ${size * 0.14})`}>
        <svg width={size * 0.72} height={size * 0.72} viewBox={`0 0 ${size * 0.72} ${size * 0.72}`}>
          <path d={moonSvgPath(frac, size * 0.36)} fill={COLORS.gold} />
        </svg>
      </g>
    </svg>
  );
}
