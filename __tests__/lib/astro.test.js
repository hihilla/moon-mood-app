import {
  ZODIAC,
  moonEclipticLongitude,
  signFromLongitude,
  moonSign,
  moonPhaseFraction,
  phaseName,
  illumination,
  angleBetween,
  computeAspects,
  aspectBetween,
  toDraconic,
  dateKey,
  fmtDate,
} from "@/lib/astro";

describe("moonEclipticLongitude", () => {
  test("always returns a value in [0, 360)", () => {
    const dates = [
      new Date("2000-01-01T00:00:00Z"),
      new Date("2026-08-10T12:00:00Z"),
      new Date("1990-06-15T03:00:00Z"),
      new Date("2050-12-31T23:59:00Z"),
    ];
    for (const d of dates) {
      const lon = moonEclipticLongitude(d);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    }
  });

  test("advances by roughly the moon's daily motion (~13°/day)", () => {
    const day1 = moonEclipticLongitude(new Date("2026-01-01T00:00:00Z"));
    const day2 = moonEclipticLongitude(new Date("2026-01-02T00:00:00Z"));
    let delta = day2 - day1;
    if (delta < 0) delta += 360; // handle wrap across 360/0
    expect(delta).toBeGreaterThan(10);
    expect(delta).toBeLessThan(16);
  });
});

describe("signFromLongitude", () => {
  test("maps 0° to Aries and wraps correctly at sign boundaries", () => {
    expect(signFromLongitude(0)).toBe("Aries");
    expect(signFromLongitude(29.99)).toBe("Aries");
    expect(signFromLongitude(30)).toBe("Taurus");
    expect(signFromLongitude(359.99)).toBe("Pisces");
    expect(signFromLongitude(360)).toBe("Aries"); // wraps
  });

  test("negative longitudes normalize before mapping", () => {
    expect(signFromLongitude(-1)).toBe("Pisces");
  });

  test("every zodiac sign is reachable", () => {
    ZODIAC.forEach((sign, i) => {
      expect(signFromLongitude(i * 30 + 15)).toBe(sign);
    });
  });
});

describe("moonSign", () => {
  test("is consistent with signFromLongitude(moonEclipticLongitude())", () => {
    const d = new Date("2026-03-15T09:00:00Z");
    expect(moonSign(d)).toBe(signFromLongitude(moonEclipticLongitude(d)));
  });
});

describe("moonPhaseFraction", () => {
  test("is ~0 at the reference new moon (2000-01-06 18:14 UTC)", () => {
    const frac = moonPhaseFraction(new Date(Date.UTC(2000, 0, 6, 18, 14, 0)));
    expect(frac).toBeCloseTo(0, 2);
  });

  test("is ~0.5 (full moon) half a synodic month after the reference new moon", () => {
    const halfMonthMs = (29.53058867 / 2) * 86400000;
    const d = new Date(Date.UTC(2000, 0, 6, 18, 14, 0) + halfMonthMs);
    const frac = moonPhaseFraction(d);
    expect(frac).toBeCloseTo(0.5, 2);
  });

  test("always returns a value in [0, 1)", () => {
    const dates = [
      new Date("1985-05-05T00:00:00Z"),
      new Date("2026-08-10T00:00:00Z"),
      new Date("2099-01-01T00:00:00Z"),
    ];
    for (const d of dates) {
      const frac = moonPhaseFraction(d);
      expect(frac).toBeGreaterThanOrEqual(0);
      expect(frac).toBeLessThan(1);
    }
  });

  test("handles dates before the reference epoch without going negative", () => {
    const frac = moonPhaseFraction(new Date("1999-01-01T00:00:00Z"));
    expect(frac).toBeGreaterThanOrEqual(0);
    expect(frac).toBeLessThan(1);
  });
});

describe("phaseName", () => {
  test.each([
    [0, "New Moon"],
    [0.1, "Waxing Crescent"],
    [0.25, "First Quarter"],
    [0.35, "Waxing Gibbous"],
    [0.5, "Full Moon"],
    [0.6, "Waning Gibbous"],
    [0.75, "Last Quarter"],
    [0.9, "Waning Crescent"],
    [0.99, "New Moon"],
  ])("frac %f -> %s", (frac, expected) => {
    expect(phaseName(frac)).toBe(expected);
  });
});

describe("illumination", () => {
  test("new moon (0) is ~0% illuminated", () => {
    expect(illumination(0)).toBeCloseTo(0, 5);
  });
  test("full moon (0.5) is ~100% illuminated", () => {
    expect(illumination(0.5)).toBeCloseTo(1, 5);
  });
  test("quarters are ~50% illuminated", () => {
    expect(illumination(0.25)).toBeCloseTo(0.5, 5);
    expect(illumination(0.75)).toBeCloseTo(0.5, 5);
  });
});

describe("angleBetween", () => {
  test("returns the short way around the circle", () => {
    expect(angleBetween(10, 20)).toBeCloseTo(10);
    expect(angleBetween(350, 10)).toBeCloseTo(20);
    expect(angleBetween(0, 180)).toBeCloseTo(180);
  });
});

describe("computeAspects", () => {
  test("detects a conjunction, square, trine, and opposition", () => {
    const planets = [
      { name: "Sun", longitude: 0 },
      { name: "Mercury", longitude: 2 }, // conjunction w/ Sun (orb 8)
      { name: "Mars", longitude: 90 }, // square w/ Sun
      { name: "Venus", longitude: 120 }, // trine w/ Sun
      { name: "Saturn", longitude: 180 }, // opposition w/ Sun
    ];
    const aspects = computeAspects(planets);
    const find = (a, b) => aspects.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));

    expect(find("Sun", "Mercury")?.type).toBe("Conjunction");
    expect(find("Sun", "Mars")?.type).toBe("Square");
    expect(find("Sun", "Venus")?.type).toBe("Trine");
    expect(find("Sun", "Saturn")?.type).toBe("Opposition");
  });

  test("does not report an aspect for an angle outside every orb", () => {
    const planets = [
      { name: "Jupiter", longitude: 0 },
      { name: "Neptune", longitude: 45 }, // not within orb of any major aspect
    ];
    const aspects = computeAspects(planets);
    expect(aspects.length).toBe(0);
  });

  test("uses a wider orb for luminaries than for other bodies", () => {
    // 97° from a square (90°): outside the 6° minor-body orb, inside the 8° luminary orb
    const withMoon = computeAspects([
      { name: "Moon", longitude: 0 },
      { name: "Mars", longitude: 97 },
    ]);
    const withoutMoon = computeAspects([
      { name: "Venus", longitude: 0 },
      { name: "Mars", longitude: 97 },
    ]);
    expect(withMoon.length).toBe(1);
    expect(withoutMoon.length).toBe(0);
  });
});

describe("aspectBetween", () => {
  test("identifies a square between transiting and natal moon", () => {
    const result = aspectBetween(90, 0);
    expect(result.type).toBe("Square");
  });

  test("returns null when no major aspect applies", () => {
    expect(aspectBetween(0, 45)).toBeNull();
  });
});

describe("toDraconic", () => {
  test("shifts the true node itself to 0°", () => {
    const planets = [{ name: "True Node", longitude: 160 }];
    const [shifted] = toDraconic(planets, 160);
    expect(shifted.longitude).toBeCloseTo(0);
  });

  test("shifts every planet by the node's longitude and wraps at 360", () => {
    const planets = [
      { name: "Sun", longitude: 10 },
      { name: "Moon", longitude: 350 },
    ];
    const [sun, moon] = toDraconic(planets, 20);
    expect(sun.longitude).toBeCloseTo(350); // 10 - 20 wraps to 350
    expect(moon.longitude).toBeCloseTo(330); // 350 - 20
    expect(sun.sign).toBe(signFromLongitude(350));
  });
});

describe("dateKey / fmtDate", () => {
  test("dateKey produces a stable YYYY-MM-DD string", () => {
    const d = new Date(Date.UTC(2026, 7, 10, 15, 30));
    expect(dateKey(d)).toBe("2026-08-10");
  });

  test("fmtDate renders a human-readable label without throwing", () => {
    const label = fmtDate("2026-08-10");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});
