// Astrology math.
//
// Two different sources of truth are used deliberately:
// - Current-moment moon sign/phase: computed locally with a low-precision
//   lunar formula (Meeus, truncated). Accurate to roughly ±1° ecliptic
//   longitude — plenty to pick the right zodiac sign and phase, but NOT
//   precise enough for a natal chart.
// - Natal chart (planets, houses, aspects, draconic): derived from the
//   freeastrologyapi.com response, which uses a real ephemeris. See
//   app/api/natal-chart/route.js.

export const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const toRad = (d) => (d * Math.PI) / 180;
const norm360 = (d) => ((d % 360) + 360) % 360;

function daysSinceJ2000(date) {
  return (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
}

export function moonEclipticLongitude(date) {
  const D = daysSinceJ2000(date);
  const L0 = norm360(218.316 + 13.176396 * D);
  const M = norm360(134.963 + 13.064993 * D);
  return norm360(L0 + 6.289 * Math.sin(toRad(M)));
}

export function signFromLongitude(lon) {
  return ZODIAC[Math.floor(norm360(lon) / 30)];
}

export function moonSign(date) {
  return signFromLongitude(moonEclipticLongitude(date));
}

export function moonPhaseFraction(date) {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMonth = 29.53058867;
  let daysSince = (date.getTime() - knownNewMoon) / 86400000;
  let phase = (daysSince % synodicMonth) / synodicMonth;
  if (phase < 0) phase += 1;
  return phase; // 0 = new, 0.5 = full
}

export function phaseName(frac) {
  if (frac < 0.03 || frac >= 0.97) return "New Moon";
  if (frac < 0.22) return "Waxing Crescent";
  if (frac < 0.28) return "First Quarter";
  if (frac < 0.47) return "Waxing Gibbous";
  if (frac < 0.53) return "Full Moon";
  if (frac < 0.72) return "Waning Gibbous";
  if (frac < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

export function illumination(frac) {
  return (1 - Math.cos(2 * Math.PI * frac)) / 2;
}

/* ---------------- Aspects ---------------- */

const ASPECT_ANGLES = {
  Conjunction: 0,
  Sextile: 60,
  Square: 90,
  Trine: 120,
  Opposition: 180,
};

// Wider orb for the luminaries (Sun/Moon), tighter for everything else —
// standard practice, not arbitrary.
function orbFor(nameA, nameB) {
  return nameA === "Sun" || nameA === "Moon" || nameB === "Sun" || nameB === "Moon" ? 8 : 6;
}

export function angleBetween(lonA, lonB) {
  const diff = Math.abs(norm360(lonA) - norm360(lonB));
  return diff > 180 ? 360 - diff : diff;
}

// planets: [{ name, longitude }]  ->  [{ a, b, type, angle, orb }]
export function computeAspects(planets) {
  const results = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      const angle = angleBetween(a.longitude, b.longitude);
      const orb = orbFor(a.name, b.name);
      for (const [type, target] of Object.entries(ASPECT_ANGLES)) {
        const delta = Math.abs(angle - target);
        if (delta <= orb) {
          results.push({ a: a.name, b: b.name, type, angle, orb: +delta.toFixed(2) });
          break;
        }
      }
    }
  }
  return results;
}

// One specific aspect check — used for "transiting moon vs natal moon" on
// the Today screen.
export function aspectBetween(lonA, lonB, nameA = "Moon", nameB = "Natal Moon") {
  const angle = angleBetween(lonA, lonB);
  const orb = orbFor(nameA, nameB);
  for (const [type, target] of Object.entries(ASPECT_ANGLES)) {
    const delta = Math.abs(angle - target);
    if (delta <= orb) return { type, angle, orb: +delta.toFixed(2) };
  }
  return null;
}

/* ---------------- Draconic chart ---------------- */

// Draconic astrology shifts the whole tropical chart so the natal True Node
// sits at 0° Aries. Purely arithmetic once you have tropical longitudes —
// no extra ephemeris call needed.
export function toDraconic(planets, trueNodeLongitude) {
  return planets.map((p) => {
    const draconicLon = norm360(p.longitude - trueNodeLongitude);
    return { ...p, longitude: draconicLon, sign: signFromLongitude(draconicLon) };
  });
}

export function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(key) {
  const d = new Date(key + "T12:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
