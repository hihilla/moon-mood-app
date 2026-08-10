/**
 * @jest-environment node
 */
import { GET } from "@/app/api/geocode/route";

function req(query) {
  return new Request(`http://localhost/api/geocode?q=${encodeURIComponent(query)}`);
}

describe("GET /api/geocode", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.resetAllMocks();
  });

  test("returns an empty list without calling the network for a too-short query", async () => {
    global.fetch = jest.fn();
    const res = await GET(req("a"));
    const body = await res.json();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(body.results).toEqual([]);
  });

  test("maps a successful Open-Meteo response to the shape the onboarding form expects", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: "Amsterdam",
            admin1: "North Holland",
            country: "Netherlands",
            latitude: 52.374,
            longitude: 4.8897,
            timezone: "Europe/Amsterdam",
          },
        ],
      }),
    });

    const res = await GET(req("Amsterdam"));
    const body = await res.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("geocoding-api.open-meteo.com");
    expect(calledUrl).toContain("Amsterdam");

    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      name: "Amsterdam",
      country: "Netherlands",
      timezone: "Europe/Amsterdam",
      latitude: 52.374,
      longitude: 4.8897,
    });
  });

  test("degrades to an empty list (not an error) when the upstream call fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const res = await GET(req("Nowhere"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
  });

  test("handles a response with no results array", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = await GET(req("Xyzzy"));
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});
