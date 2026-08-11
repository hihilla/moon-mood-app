import { getUtcOffsetHours } from "@/lib/timezone";

describe("getUtcOffsetHours", () => {
  test("UTC is always 0", () => {
    expect(getUtcOffsetHours(new Date("2026-08-10T00:00:00Z"), "UTC")).toBe(0);
  });

  test("resolves Amsterdam winter time (CET, +1) correctly", () => {
    // January — no DST in the Netherlands
    const offset = getUtcOffsetHours(new Date("2026-01-15T12:00:00Z"), "Europe/Amsterdam");
    expect(offset).toBe(1);
  });

  test("resolves Amsterdam summer time (CEST, +2) correctly", () => {
    // July — DST in effect
    const offset = getUtcOffsetHours(new Date("2026-07-15T12:00:00Z"), "Europe/Amsterdam");
    expect(offset).toBe(2);
  });

  test("resolves a historical date before a person's birth correctly", () => {
    // Sanity check that this isn't just reading the *current* offset —
    // the Netherlands has observed CET/CEST since 1940s DST rules stabilized.
    const offset = getUtcOffsetHours(new Date("1990-07-01T12:00:00Z"), "Europe/Amsterdam");
    expect(offset).toBe(2);
  });

  test("handles a negative, non-integer offset (e.g. Newfoundland, UTC-3:30)", () => {
    const offset = getUtcOffsetHours(new Date("2026-01-15T12:00:00Z"), "America/St_Johns");
    // St. John's is UTC-3:30 standard time, UTC-2:30 during DST
    expect([-3.5, -2.5]).toContain(offset);
  });

  test("falls back gracefully rather than throwing on an unusual zone", () => {
    expect(() => getUtcOffsetHours(new Date(), "Asia/Kathmandu")).not.toThrow();
  });

  describe("with a mocked Intl (forcing otherwise-unreachable fallback branches)", () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;

    afterEach(() => {
      global.Intl.DateTimeFormat = RealDateTimeFormat;
    });

    test("returns 0 when the resolved offset string doesn't match GMT±H[:MM] at all", () => {
      // Real environments occasionally resolve to a bare zone abbreviation
      // (e.g. "UTC") instead of "GMT+0" — the regex won't match that.
      global.Intl.DateTimeFormat = function () {
        return { formatToParts: () => [{ type: "timeZoneName", value: "UTC" }] };
      };
      expect(getUtcOffsetHours(new Date(), "Some/Zone")).toBe(0);
    });

    test("falls back to the GMT+0 default when no timeZoneName part is present", () => {
      global.Intl.DateTimeFormat = function () {
        return { formatToParts: () => [{ type: "literal", value: "" }] }; // no timeZoneName entry
      };
      expect(getUtcOffsetHours(new Date(), "Some/Zone")).toBe(0);
    });
  });
});
