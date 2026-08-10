import { computeAspects, toDraconic } from "@/lib/astro";

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
  // freeastrologyapi returns { output: [{ planet: {en}, fullDegree, zodiac_sign, isRetro }, ...] }
  return (apiOutput.output || []).map((p) => ({
    name: p.planet.en,
    longitude: p.fullDegree,
    sign: p.zodiac_sign.name.en,
    retrograde: String(p.isRetro).toLowerCase() === "true",
  }));
}

function toHouseList(apiOutput) {
  return (apiOutput.output?.Houses || []).map((h) => ({
    house: h.House,
    longitude: h.degree,
    sign: h.zodiac_sign.name.en,
  }));
}

export async function POST(req) {
  try {
    const birth = await req.json();
    // birth: { year, month, date, hours, minutes, seconds, latitude, longitude, timezone }

    const base = { ...birth };

    const [tropicalPlanetsRaw, tropicalHousesRaw, siderealPlanetsRaw, siderealHousesRaw] =
      await Promise.all([
        callApi("western/planets", {
          ...base,
          config: { observation_point: "geocentric", ayanamsha: "tropical", language: "en" },
        }),
        callApi("western/houses", {
          ...base,
          config: {
            observation_point: "geocentric",
            ayanamsha: "tropical",
            house_system: "Placidus",
            language: "en",
          },
        }),
        callApi("western/planets", {
          ...base,
          config: { observation_point: "geocentric", ayanamsha: "lahiri", language: "en" },
        }),
        callApi("western/houses", {
          ...base,
          config: {
            observation_point: "geocentric",
            ayanamsha: "lahiri",
            house_system: "Placidus",
            language: "en",
          },
        }),
      ]);

    const tropicalPlanets = toPlanetList(tropicalPlanetsRaw);
    const tropicalHouses = toHouseList(tropicalHousesRaw);
    const siderealPlanets = toPlanetList(siderealPlanetsRaw);
    const siderealHouses = toHouseList(siderealHousesRaw);

    const trueNode = tropicalPlanets.find((p) => p.name === "True Node");
    const draconicPlanets = trueNode
      ? toDraconic(tropicalPlanets, trueNode.longitude)
      : [];

    const bodiesForAspects = tropicalPlanets.filter((p) =>
      ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Ascendant", "MC"].includes(
        p.name
      )
    );
    const aspects = computeAspects(bodiesForAspects);

    return Response.json({
      tropical: { planets: tropicalPlanets, houses: tropicalHouses },
      sidereal: { planets: siderealPlanets, houses: siderealHouses },
      draconic: { planets: draconicPlanets },
      aspects,
      computedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
