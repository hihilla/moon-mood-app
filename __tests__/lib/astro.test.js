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
  houseForLongitude,
  buildDailyHoroscope,
  buildFullHoroscope,
  PLANET_THEME,
  HOUSE_MEANING,
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

describe("houseForLongitude", () => {
  const evenHouses = Array.from({ length: 12 }, (_, i) => ({ house: i + 1, longitude: i * 30 }));

  test("places a longitude in the correct evenly-spaced house", () => {
    expect(houseForLongitude(5, evenHouses)).toBe(1);
    expect(houseForLongitude(35, evenHouses)).toBe(2);
    expect(houseForLongitude(355, evenHouses)).toBe(12);
  });

  test("is inclusive of a house's own cusp and exclusive of the next", () => {
    expect(houseForLongitude(30, evenHouses)).toBe(2); // exactly on house 2's cusp -> house 2
    expect(houseForLongitude(29.999, evenHouses)).toBe(1); // just before -> still house 1
  });

  test("handles a house range that wraps past 360°/0°", () => {
    const wrapping = Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      longitude: norm360Test(350 + i * 30),
    }));
    // house 1 now starts at 350° and wraps to house 2's cusp near 20°
    expect(houseForLongitude(355, wrapping)).toBe(1);
    expect(houseForLongitude(5, wrapping)).toBe(1);
  });

  test("returns null when houses data is missing or incomplete", () => {
    expect(houseForLongitude(10, null)).toBeNull();
    expect(houseForLongitude(10, undefined)).toBeNull();
    expect(houseForLongitude(10, [])).toBeNull();
    expect(houseForLongitude(10, [{ house: 1, longitude: 0 }])).toBeNull();
  });

  test("does not depend on the input array's order", () => {
    const shuffled = [...evenHouses].reverse();
    expect(houseForLongitude(100, shuffled)).toBe(houseForLongitude(100, evenHouses));
  });
});

function norm360Test(d) {
  return ((d % 360) + 360) % 360;
}

describe("buildDailyHoroscope", () => {
  const evenHouses = Array.from({ length: 12 }, (_, i) => ({ house: i + 1, longitude: i * 30 }));

  test("identifies the correct house and describes it in plain language", () => {
    const result = buildDailyHoroscope({
      transitLongitude: 100, // falls in house 4 (90-120 range)
      natalPlanets: [],
      natalHouses: evenHouses,
    });
    expect(result.house).toBe(4);
    expect(result.houseLine).toMatch(/4th house/);
    expect(result.houseLine).toMatch(/home, family, and roots/);
    expect(result.houseLine).toMatch(/^The moon is moving/); // explicit subject, not "It's"
  });

  test("picks the tightest-orb aspect among multiple natal planets", () => {
    const result = buildDailyHoroscope({
      transitLongitude: 0,
      natalPlanets: [
        { name: "Sun", longitude: 92 }, // square, orb 2
        { name: "Mars", longitude: 89 }, // square, orb 1 — tighter, should win
      ],
      natalHouses: evenHouses,
    });
    expect(result.topAspect.planet).toBe("Mars");
    expect(result.aspectLine).toMatch(/drive, temper, and motivation/);
    expect(result.aspectLine).not.toMatch(/Square/); // jargon should not leak through
  });

  test("returns null lines gracefully when there's no natal chart data", () => {
    const result = buildDailyHoroscope({ transitLongitude: 10, natalPlanets: [], natalHouses: null });
    expect(result.houseLine).toBeNull();
    expect(result.aspectLine).toBeNull();
    expect(result.topAspect).toBeNull();
  });

  test("ignores natal bodies with no PLANET_THEME entry (e.g. True Node)", () => {
    const result = buildDailyHoroscope({
      transitLongitude: 0,
      natalPlanets: [{ name: "True Node", longitude: 2 }], // would be a tight conjunction
      natalHouses: evenHouses,
    });
    expect(result.topAspect).toBeNull();
  });
});

describe("buildFullHoroscope", () => {
  const evenHouses = Array.from({ length: 12 }, (_, i) => ({ house: i + 1, longitude: i * 30 }));
  const natalPlanets = [
    { name: "Sun", longitude: 10 },
    { name: "Moon", longitude: 190 },
    { name: "Mars", longitude: 100 },
  ];

  test("always includes an entry for the moon, using the locally-computed longitude", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [],
      natalPlanets,
      natalHouses: evenHouses,
    });
    const moonEntry = result.find((r) => r.planet === "Moon");
    expect(moonEntry).toBeDefined();
    expect(moonEntry.house).toBe(1); // longitude 15 -> house 1
  });

  test("includes every transiting planet with a known theme, e.g. the Sun", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [
        { name: "Sun", longitude: 200 },
        { name: "Mercury", longitude: 205 },
      ],
      natalPlanets,
      natalHouses: evenHouses,
    });
    expect(result.map((r) => r.planet)).toEqual(expect.arrayContaining(["Sun", "Mercury", "Moon"]));
  });

  test("drops planets without a PLANET_THEME entry from the reading (e.g. True Node)", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "True Node", longitude: 50 }],
      natalPlanets,
      natalHouses: evenHouses,
    });
    expect(result.find((r) => r.planet === "True Node")).toBeUndefined();
  });

  test("de-duplicates the moon if the API also returns one — local longitude wins", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Moon", longitude: 999 }], // should be filtered out, not used
      natalPlanets,
      natalHouses: evenHouses,
    });
    const moonEntries = result.filter((r) => r.planet === "Moon");
    expect(moonEntries).toHaveLength(1);
    expect(moonEntries[0].house).toBe(houseForLongitude(15, evenHouses));
  });

  test("each entry includes the planet's own theme once, for use as a heading subtitle", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Sun", longitude: 200 }],
      natalPlanets,
      natalHouses: evenHouses,
    });
    const sunEntry = result.find((r) => r.planet === "Sun");
    const moonEntry = result.find((r) => r.planet === "Moon");
    expect(sunEntry.theme).toBe("sense of identity and confidence");
    expect(moonEntry.theme).toBe("emotions and gut reactions");
  });

  test("houseFact is a standalone clause, not a full sentence repeating the planet as subject", () => {
    const result = buildFullHoroscope({
      moonLongitude: 100, // house 4
      transitPlanets: [],
      natalPlanets,
      natalHouses: evenHouses,
    });
    const moonEntry = result.find((r) => r.planet === "Moon");
    expect(moonEntry.houseFact).toBe("Focused on home, family, and roots.");
    expect(moonEntry.houseFact).not.toMatch(/Moon/); // no repeated subject
  });

  test("aspectFact names the natal planet explicitly, not a bare pronoun, and is capitalized", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Venus", longitude: 10 }], // conjunct natal Sun @ 10
      natalPlanets,
      natalHouses: evenHouses,
    });
    const venusEntry = result.find((r) => r.planet === "Venus");
    expect(venusEntry.aspectFact).toBe("Intensifying your natal Sun — sense of identity and confidence.");
    expect(venusEntry.aspectFact).not.toMatch(/^It's/);
    expect(venusEntry.aspectFact).not.toMatch(/^Your Venus/); // no repeated subject either
  });

  test("a transiting planet can aspect a natal planet of the same name", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Sun", longitude: 12 }], // conjunct natal Sun @ 10, orb 2
      natalPlanets,
      natalHouses: evenHouses,
    });
    const sunEntry = result.find((r) => r.planet === "Sun");
    expect(sunEntry.topAspect.natalPlanet).toBe("Sun");
    expect(sunEntry.aspectFact).toMatch(/sense of identity and confidence/);
  });

  test("ignores obscure natal bodies with no plain-language theme (e.g. Ceres) as aspect targets", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Venus", longitude: 10 }],
      natalPlanets: [{ name: "Ceres", longitude: 10 }], // exact conjunction, but no theme exists for it
      natalHouses: evenHouses,
    });
    const venusEntry = result.find((r) => r.planet === "Venus");
    expect(venusEntry.aspectFact).toBeNull();
    expect(venusEntry.topAspect).toBeNull();
  });

  test("never lets Ascendant or MC act as the transiting body, even if present in transitPlanets", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [
        { name: "Ascendant", longitude: 50 },
        { name: "MC", longitude: 60 },
      ],
      natalPlanets,
      natalHouses: evenHouses,
    });
    expect(result.find((r) => r.planet === "Ascendant")).toBeUndefined();
    expect(result.find((r) => r.planet === "MC")).toBeUndefined();
  });

  test("Ascendant/MC can still be the target of a real transiting planet's aspect", () => {
    const natalWithAngles = [...natalPlanets, { name: "Ascendant", longitude: 50 }];
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Venus", longitude: 52 }], // conjunct natal Ascendant
      natalPlanets: natalWithAngles,
      natalHouses: evenHouses,
    });
    const venusEntry = result.find((r) => r.planet === "Venus");
    expect(venusEntry.topAspect.natalPlanet).toBe("Ascendant");
    expect(venusEntry.aspectFact).toMatch(/the way you come across to others/);
  });

  test("returns houseFact/aspectFact as null, not throwing, with no natal chart at all", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: [{ name: "Sun", longitude: 200 }],
      natalPlanets: [],
      natalHouses: null,
    });
    result.forEach((r) => {
      expect(r.houseFact).toBeNull();
      expect(r.aspectFact).toBeNull();
    });
  });

  test("handles a null transitPlanets (e.g. still loading) without throwing", () => {
    expect(() =>
        buildFullHoroscope({ moonLongitude: 15, transitPlanets: null, natalPlanets, natalHouses: evenHouses })
    ).not.toThrow();
  });

  test("every PLANET_THEME entry used in a line is a known, non-empty string", () => {
    const result = buildFullHoroscope({
      moonLongitude: 15,
      transitPlanets: Object.keys(PLANET_THEME)
          .filter((name) => name !== "Ascendant" && name !== "MC")
          .map((name, i) => ({ name, longitude: i * 17 })),
      natalPlanets,
      natalHouses: evenHouses,
    });
    result.forEach((r) => {
      if (r.aspectFact) {
        expect(r.aspectFact.length).toBeGreaterThan(10);
      }
    });
  });
});

describe("HOUSE_MEANING / PLANET_THEME data integrity", () => {
  test("every house 1-12 has a meaning defined", () => {
    for (let h = 1; h <= 12; h++) {
      expect(HOUSE_MEANING[h]).toBeTruthy();
    }
  });

  test("core chart bodies all have a theme defined", () => {
    ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].forEach(
        (name) => {
          expect(PLANET_THEME[name]).toBeTruthy();
        }
    );
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