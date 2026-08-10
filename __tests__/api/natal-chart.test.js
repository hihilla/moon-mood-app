/**
 * @jest-environment node
 */
import { POST } from "@/app/api/natal-chart/route";

const TROPICAL_PLANETS = [
  { planet: { en: "Sun" }, fullDegree: 10, normDegree: 10, isRetro: "False", zodiac_sign: { number: 1, name: { en: "Aries" } } },
  { planet: { en: "Moon" }, fullDegree: 100, normDegree: 10, isRetro: "False", zodiac_sign: { number: 4, name: { en: "Cancer" } } },
  { planet: { en: "Mars" }, fullDegree: 190, normDegree: 10, isRetro: "false", zodiac_sign: { number: 7, name: { en: "Libra" } } },
  { planet: { en: "Mercury" }, fullDegree: 12, normDegree: 12, isRetro: "true", zodiac_sign: { number: 1, name: { en: "Aries" } } },
  { planet: { en: "Venus" }, fullDegree: 130, normDegree: 10, isRetro: "false", zodiac_sign: { number: 5, name: { en: "Leo" } } },
  { planet: { en: "Jupiter" }, fullDegree: 40, normDegree: 10, isRetro: "false", zodiac_sign: { number: 2, name: { en: "Taurus" } } },
  { planet: { en: "Saturn" }, fullDegree: 70, normDegree: 10, isRetro: "false", zodiac_sign: { number: 3, name: { en: "Gemini" } } },
  { planet: { en: "Uranus" }, fullDegree: 200, normDegree: 20, isRetro: "false", zodiac_sign: { number: 7, name: { en: "Libra" } } },
  { planet: { en: "Neptune" }, fullDegree: 250, normDegree: 10, isRetro: "false", zodiac_sign: { number: 9, name: { en: "Sagittarius" } } },
  { planet: { en: "Pluto" }, fullDegree: 280, normDegree: 10, isRetro: "false", zodiac_sign: { number: 10, name: { en: "Capricorn" } } },
  { planet: { en: "Ascendant" }, fullDegree: 52, normDegree: 22, isRetro: "False", zodiac_sign: { number: 2, name: { en: "Taurus" } } },
  { planet: { en: "MC" }, fullDegree: 311, normDegree: 11, isRetro: "False", zodiac_sign: { number: 11, name: { en: "Aquarius" } } },
  { planet: { en: "True Node" }, fullDegree: 100, normDegree: 10, isRetro: "True", zodiac_sign: { number: 4, name: { en: "Cancer" } } },
];

const HOUSES = Array.from({ length: 12 }, (_, i) => ({
  House: i + 1,
  degree: i * 30 + 5,
  normDegree: 5,
  zodiac_sign: { number: i + 1, name: { en: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"][i] } },
}));

function mockFetchImpl(url, options) {
  const body = JSON.parse(options.body);
  const ayanamsha = body.config?.ayanamsha;
  if (url.endsWith("/western/planets")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ statusCode: 200, output: TROPICAL_PLANETS.map((p) => ({ ...p, _ayanamsha: ayanamsha })) }),
      text: async () => "",
    });
  }
  if (url.endsWith("/western/houses")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ statusCode: 200, output: { Houses: HOUSES } }),
      text: async () => "",
    });
  }
  return Promise.resolve({ ok: false, status: 404, text: async () => "not found" });
}

function req(payload) {
  return new Request("http://localhost/api/natal-chart", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const BIRTH_PAYLOAD = {
  year: 1995, month: 6, date: 10, hours: 8, minutes: 15, seconds: 0,
  latitude: 52.374, longitude: 4.8897, timezone: 2,
};

describe("POST /api/natal-chart", () => {
  const realFetch = global.fetch;
  const realKey = process.env.FREE_ASTROLOGY_API_KEY;

  beforeEach(() => {
    process.env.FREE_ASTROLOGY_API_KEY = "test-key";
    global.fetch = jest.fn(mockFetchImpl);
  });

  afterEach(() => {
    global.fetch = realFetch;
    process.env.FREE_ASTROLOGY_API_KEY = realKey;
    jest.resetAllMocks();
  });

  test("calls the API four times: tropical/sidereal x planets/houses", async () => {
    await POST(req(BIRTH_PAYLOAD));
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const urls = global.fetch.mock.calls.map((c) => c[0]);
    expect(urls.filter((u) => u.endsWith("/western/planets"))).toHaveLength(2);
    expect(urls.filter((u) => u.endsWith("/western/houses"))).toHaveLength(2);
  });

  test("sends the API key as a header, never in the request body", async () => {
    await POST(req(BIRTH_PAYLOAD));
    for (const [, options] of global.fetch.mock.calls) {
      expect(options.headers["x-api-key"]).toBe("test-key");
      expect(JSON.stringify(options.body)).not.toContain("test-key");
    }
  });

  test("returns tropical and sidereal planets and houses", async () => {
    const res = await POST(req(BIRTH_PAYLOAD));
    const body = await res.json();

    expect(body.tropical.planets).toHaveLength(TROPICAL_PLANETS.length);
    expect(body.tropical.houses).toHaveLength(12);
    expect(body.sidereal.planets).toHaveLength(TROPICAL_PLANETS.length);
    expect(body.sidereal.houses).toHaveLength(12);
  });

  test("derives the draconic chart locally by shifting everything to the True Node", async () => {
    const res = await POST(req(BIRTH_PAYLOAD));
    const body = await res.json();

    const draconicNode = body.draconic.planets.find((p) => p.name === "True Node");
    expect(draconicNode.longitude).toBeCloseTo(0);

    // Moon was conjunct the node in the fixture (both at 100°) -> draconic Moon also lands at 0°
    const draconicMoon = body.draconic.planets.find((p) => p.name === "Moon");
    expect(draconicMoon.longitude).toBeCloseTo(0);
  });

  test("computes aspects from the tropical longitudes without an extra API call", async () => {
    const res = await POST(req(BIRTH_PAYLOAD));
    const body = await res.json();

    // Sun at 10°, Mars at 190° -> 180° apart -> Opposition
    const sunMars = body.aspects.find(
      (a) => (a.a === "Sun" && a.b === "Mars") || (a.a === "Mars" && a.b === "Sun")
    );
    expect(sunMars?.type).toBe("Opposition");
  });

  test("returns a 500 with an error message if an upstream call fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "upstream down" });
    const res = await POST(req(BIRTH_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
  });
});
