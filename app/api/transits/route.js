// Today's transiting planets (Sun through Pluto). Geocentric ecliptic
// longitude doesn't meaningfully depend on the observer's location on
// Earth's surface (that's what "geocentric" means), so a fixed placeholder
// location is fine here — we only need the planets' positions, not a
// "current ascendant/houses", which genuinely would depend on exact time
// and place and isn't a stable enough concept for a daily reading anyway.

const BASE = "https://json.freeastrologyapi.com";

async function callApi(path, payload) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.FREE_ASTROLOGY_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function toPlanetList(apiOutput) {
  return (apiOutput.output || []).map((p) => ({
    name: p.planet.en,
    longitude: p.fullDegree,
    sign: p.zodiac_sign.name.en,
    retrograde: String(p.isRetro).toLowerCase() === "true",
  }));
}

export async function GET() {
  try {
    const now = new Date();
    const payload = {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      date: now.getUTCDate(),
      hours: now.getUTCHours(),
      minutes: now.getUTCMinutes(),
      seconds: 0,
      latitude: 51.4779, // Greenwich — placeholder, doesn't affect planet longitudes
      longitude: -0.0015,
      timezone: 0,
      config: { observation_point: "geocentric", ayanamsha: "tropical", language: "en" },
    };

    const raw = await callApi("western/planets", payload);
    const planets = toPlanetList(raw);

    return Response.json({ planets, computedAt: now.toISOString() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
