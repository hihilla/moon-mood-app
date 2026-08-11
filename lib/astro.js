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

/* ---------------- Houses & personalized daily reading ---------------- */

// Which of the person's 12 natal houses a given ecliptic longitude falls in.
// houses: [{ house: 1..12, longitude: cusp degree }] — house N's range runs
// from its own cusp up to house N+1's cusp (wrapping at house 12 -> 1).
export function houseForLongitude(lon, houses) {
  if (!houses || houses.length !== 12) return null;
  const sorted = [...houses].sort((a, b) => a.house - b.house);
  const target = norm360(lon);
  for (let i = 0; i < 12; i++) {
    const start = norm360(sorted[i].longitude);
    const end = norm360(sorted[(i + 1) % 12].longitude);
    if (start < end) {
      if (target >= start && target < end) return sorted[i].house;
    } else {
      // this house's range wraps past 360°/0°
      if (target >= start || target < end) return sorted[i].house;
    }
  }
  return null;
}

function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

// Plain-language life area for each house — no jargon, just what it's about.
export const HOUSE_MEANING = {
  1: "yourself — how you show up and come across",
  2: "money, possessions, and what you value",
  3: "communication, siblings, and everyday learning",
  4: "home, family, and roots",
  5: "creativity, romance, and fun",
  6: "daily routine, work, and health habits",
  7: "close relationships and partnerships",
  8: "shared resources, intimacy, and change",
  9: "beliefs, travel, and the bigger picture",
  10: "career and public reputation",
  11: "friends, community, and future goals",
  12: "rest, privacy, and things left unsaid",
};

// What each planet represents, in plain terms — used to turn "Moon square
// Mars" into "friction around your drive and temper".
export const PLANET_THEME = {
  Sun: "sense of identity and confidence",
  Moon: "emotions and gut reactions",
  Mercury: "thinking and communication",
  Venus: "relationships and what feels good",
  Mars: "drive, temper, and motivation",
  Jupiter: "optimism and where you want to grow",
  Saturn: "discipline, limits, and responsibility",
  Uranus: "need for freedom and sudden change",
  Neptune: "imagination, dreams, and blurred edges",
  Pluto: "deep change and control",
  Ascendant: "the way you come across to others",
  MC: "career and public reputation",
};

// Plain-language tone for each aspect angle — replaces jargon like "Square"
// or "Trine" with what it's traditionally meant to feel like.
export const ASPECT_TONE = {
  Conjunction: "intensifying",
  Sextile: "opening up an easy opportunity around",
  Square: "creating friction around",
  Trine: "bringing ease and flow to",
  Opposition: "pulling you in two directions around",
};

// Builds a short, personalized, jargon-free reading for "today's transiting
// moon against this person's natal chart" — which house it's moving
// through, and its single tightest-orb aspect to a natal planet.
export function buildDailyHoroscope({ transitLongitude, natalPlanets, natalHouses }) {
  const house = houseForLongitude(transitLongitude, natalHouses);
  const houseLine = house
      ? `The moon is moving through your ${ordinal(house)} house — the part of your chart about ${HOUSE_MEANING[house]}.`
      : null;

  const candidates = (natalPlanets || [])
      .filter((p) => PLANET_THEME[p.name])
      .map((p) => {
        const aspect = aspectBetween(transitLongitude, p.longitude, "Moon", p.name);
        return aspect ? { planet: p.name, ...aspect } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.orb - b.orb);

  const top = candidates[0] || null;
  const aspectLine = top
      ? `Today's moon is ${ASPECT_TONE[top.type]} your ${PLANET_THEME[top.planet]}.`
      : null;

  return { house, houseLine, topAspect: top, aspectLine };
}

// Angles (Ascendant, MC) are meaningful as fixed points in a NATAL chart,
// but they don't have a stable "transiting position" the way a real planet
// does — an angle's position depends entirely on the exact time and place
// you're standing, which is meaningless for a generic "today" reading (see
// the placeholder-location note in app/api/transits/route.js). So they're
// never allowed to act as the moving/transiting body — only as a natal
// target that a real transiting planet can aspect.
const NOT_A_TRANSITING_BODY = new Set(["Ascendant", "MC"]);

// Builds a personalized reading covering every transiting planet against
// the natal chart — which natal house each is currently moving through,
// and its single tightest-orb aspect to a natal planet. This is the "full
// horoscope" version: Sun, Moon, and everything else, not just the moon.
//
// moonLongitude uses the local low-precision formula (already accurate
// enough for sign/phase); transitPlanets (Sun through Pluto) come from a
// real ephemeris via /api/transits, since the local formula only covers
// the moon.
export function buildFullHoroscope({ moonLongitude, transitPlanets, natalPlanets, natalHouses }) {
  const allTransits = [
    { name: "Moon", longitude: moonLongitude },
    ...(transitPlanets || []).filter((p) => p.name !== "Moon"),
  ];

  // Only match against natal bodies we actually have a plain-language
  // theme for. The API returns extra minor bodies (Ceres, Chiron, and
  // similar asteroids/points) alongside the real planets — without this
  // filter, a tight aspect to one of those would surface as nonsense like
  // "bringing ease and flow to your Ceres".
  const namedNatalPlanets = (natalPlanets || []).filter((np) => PLANET_THEME[np.name]);

  return allTransits
      .filter((p) => PLANET_THEME[p.name] && !NOT_A_TRANSITING_BODY.has(p.name))
      .map((p) => {
        const house = houseForLongitude(p.longitude, natalHouses);
        const houseLine = house
            ? `Transiting ${p.name === "Moon" ? "moon" : p.name} is moving through your ${ordinal(house)} house — the part of your chart about ${HOUSE_MEANING[house]}.`
            : null;

        const natalMatches = namedNatalPlanets
            .map((np) => {
              const aspect = aspectBetween(p.longitude, np.longitude, p.name, np.name);
              return aspect ? { natalPlanet: np.name, ...aspect } : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.orb - b.orb);

        const topAspect = natalMatches[0] || null;
        const targetTheme = topAspect && PLANET_THEME[topAspect.natalPlanet];
        const subject = p.name === "Moon" ? "The moon" : `Transiting ${p.name}`;
        const aspectLine = topAspect
            ? `${subject} is ${ASPECT_TONE[topAspect.type]} your ${targetTheme}.`
            : null;

        return { planet: p.name, house, houseLine, topAspect, aspectLine };
      });
}

export function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(key) {
  const d = new Date(key + "T12:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}