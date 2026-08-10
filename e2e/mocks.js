// Shared network stubs. These intercept requests at the browser boundary
// (page.route), so they only cover client-side @supabase/supabase-js calls —
// not our own server-side API routes, which are covered separately by the
// Jest integration tests in __tests__/api.
//
// Caveat: these mimic Supabase's wire format from the public GoTrue/PostgREST
// docs, not a live project. If Supabase changes their response shape, these
// may need a small update — treat this file as the thing to fix first if an
// e2e test starts failing after a @supabase/supabase-js upgrade.

const FAKE_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "alex@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};

export async function mockSignIn(page) {
  await page.route("**/auth/v1/token*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fake-access-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fake-refresh-token",
        user: FAKE_USER,
      }),
    });
  });

  await page.route("**/auth/v1/user*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_USER),
    });
  });
}

export async function mockProfile(page, profile = null) {
  await page.route("**/rest/v1/profiles*", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profile),
      });
    } else {
      // upsert (POST/PATCH) — echo back success
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(profile ? [profile] : []),
      });
    }
  });
}

export async function mockEntries(page, entries = []) {
  await page.route("**/rest/v1/entries*", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entries),
      });
    } else {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(entries),
      });
    }
  });
}

export const FAKE_CHART = {
  tropical: {
    planets: [
      { name: "Sun", longitude: 79.5, sign: "Gemini", retrograde: false },
      { name: "Moon", longitude: 200.3, sign: "Libra", retrograde: false },
    ],
    houses: Array.from({ length: 12 }, (_, i) => ({ house: i + 1, longitude: i * 30, sign: "Aries" })),
  },
  sidereal: { planets: [], houses: [] },
  draconic: { planets: [] },
  aspects: [],
  computedAt: new Date().toISOString(),
};
