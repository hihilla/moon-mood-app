/**
 * @jest-environment node
 */
import { GET } from "@/app/api/transits/route";

const TRANSIT_PLANETS = [
  { planet: { en: "Sun" }, fullDegree: 138.2, normDegree: 18.2, isRetro: "False", zodiac_sign: { number: 5, name: { en: "Leo" } } },
  { planet: { en: "Moon" }, fullDegree: 250.7, normDegree: 10.7, isRetro: "False", zodiac_sign: { number: 9, name: { en: "Sagittarius" } } },
  { planet: { en: "Mercury" }, fullDegree: 150.1, normDegree: 0.1, isRetro: "true", zodiac_sign: { number: 6, name: { en: "Virgo" } } },
  { planet: { en: "Venus" }, fullDegree: 170.4, normDegree: 20.4, isRetro: "false", zodiac_sign: { number: 6, name: { en: "Virgo" } } },
  { planet: { en: "Mars" }, fullDegree: 200.9, normDegree: 20.9, isRetro: "false", zodiac_sign: { number: 7, name: { en: "Libra" } } },
  { planet: { en: "Ascendant" }, fullDegree: 12.4, normDegree: 12.4, isRetro: "False", zodiac_sign: { number: 1, name: { en: "Aries" } } },
  { planet: { en: "MC" }, fullDegree: 280.1, normDegree: 10.1, isRetro: "False", zodiac_sign: { number: 10, name: { en: "Capricorn" } } },
];

function mockFetchImpl(url, options) {
  const body = JSON.parse(options.body);
  if (url.endsWith("/western/planets")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ statusCode: 200, output: TRANSIT_PLANETS }),
      text: async () => "",
      _requestBody: body, // exposed for assertions
    });
  }
  return Promise.resolve({ ok: false, status: 404, text: async () => "not found" });
}

describe("GET /api/transits", () => {
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

  test("calls the API exactly once with tropical config", async () => {
    await GET();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/western/planets");
    const body = JSON.parse(options.body);
    expect(body.config.ayanamsha).toBe("tropical");
    expect(body.config.observation_point).toBe("geocentric");
  });

  test("uses today's date/time (UTC), not the birth-chart concept of a fixed date", async () => {
    const before = new Date();
    await GET();
    const after = new Date();
    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const sent = new Date(Date.UTC(body.year, body.month - 1, body.date, body.hours, body.minutes));
    expect(sent.getTime()).toBeGreaterThanOrEqual(before.getTime() - 60000);
    expect(sent.getTime()).toBeLessThanOrEqual(after.getTime() + 60000);
  });

  test("sends the API key as a header, never in the request body", async () => {
    await GET();
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers["x-api-key"]).toBe("test-key");
    expect(options.body).not.toContain("test-key");
  });

  test("returns a flat list of planets with name/longitude/sign/retrograde", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.planets).toHaveLength(TRANSIT_PLANETS.length - 2); // minus Ascendant/MC, filtered out
    const sun = body.planets.find((p) => p.name === "Sun");
    expect(sun).toMatchObject({ name: "Sun", longitude: 138.2, sign: "Leo", retrograde: false });
    const mercury = body.planets.find((p) => p.name === "Mercury");
    expect(mercury.retrograde).toBe(true);
  });

  test("filters out Ascendant and MC — angles, not planets, with no meaningful transiting position", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.planets.find((p) => p.name === "Ascendant")).toBeUndefined();
    expect(body.planets.find((p) => p.name === "MC")).toBeUndefined();
  });

  test("includes a computedAt timestamp", async () => {
    const res = await GET();
    const body = await res.json();
    expect(new Date(body.computedAt).toString()).not.toBe("Invalid Date");
  });

  test("returns a 500 with an error message if the upstream call fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "upstream down" });
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
  });

  test("does not crash on a malformed upstream response (missing output)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = await GET();
    const body = await res.json();
    expect(body.planets).toEqual([]);
  });

  test("falls back to stringifying the raw error when it has no .message property", async () => {
    global.fetch = jest.fn().mockRejectedValue("raw string failure");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("raw string failure");
  });
});
