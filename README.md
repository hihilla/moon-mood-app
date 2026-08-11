# Moon & Mood

A private mood/period tracker with real natal chart data. Built to be hosted
by you, for you — not published anywhere public.

## What's actually accurate here

- **Today's moon phase and sign**: computed locally with a low-precision
  lunar formula. Good to roughly ±1° — fine for picking the right sign, not
  observatory-grade.
- **Natal chart (planets, houses, aspects, draconic)**: pulled from
  [freeastrologyapi.com](https://freeastrologyapi.com), which uses a real
  ephemeris. This is the accurate part.
- **Cycle/ovulation prediction**: pure calendar math (average gap between
  logged period starts, ovulation estimated 14 days before the next
  predicted period). This is a rough estimate, same as any period app —
  not a substitute for BBT charting or ovulation test strips.

## One-time setup

### 1. Supabase (database + login)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run everything in `supabase/schema.sql`.
3. In Project Settings → API, copy the **Project URL** and **anon public key**.
4. In Authentication → Providers, make sure Email is enabled. Since this is
   just for you, you can also turn off "Confirm email" under
   Authentication → Settings to skip email verification.

### 2. freeastrologyapi.com (natal chart data)

1. Sign up at [freeastrologyapi.com](https://freeastrologyapi.com/signup) —
   free tier.
2. Copy your API key from the dashboard.
3. **Check their current request format against your account docs before
   relying on it** — I built the `/api/natal-chart` route against their
   published reference, but third-party APIs change their schema without
   notice, and I can't call their endpoint from here to verify it live.

### 3. Local setup

```bash
npm install
cp .env.local.example .env.local
# fill in .env.local with your Supabase and API key values
npm run dev
```

Open `http://localhost:3000`, create an account (any email/password —
it's just for you), then go to `/onboarding` to generate your chart.

### 4. Deploy (Vercel, free tier)

1. Push this folder to a new GitHub repo.
2. Go to [vercel.com](https://vercel.com), "Add New Project", import the repo.
3. Under Environment Variables, add the same three values from `.env.local`.
4. Deploy. You'll get a `your-app.vercel.app` URL — bookmark it on your phone.

Because it requires sign-in and there's no public signup link shared
anywhere, this stays private in practice even though the URL itself isn't
secret. If you want it properly locked down, Vercel's free tier also
supports password-protecting a deployment under Project Settings.

## Testing

Three layers, increasing in how much they trust the outside world:

```bash
npm test              # unit + integration (Jest) — no network, no browser
npm run test:watch    # same, in watch mode while you edit
npm run test:e2e      # end-to-end (Playwright) — real browser, mocked network
npm run test:e2e:ui   # same, with Playwright's interactive UI
npx jest --coverage   # test coverage
```

- **Unit tests** (`__tests__/lib`) — the moon phase/sign math, aspect
  detection, draconic derivation, and the timezone offset helper. Pure
  functions, no mocking needed. This is the layer I'm most confident in,
  since I could reason through the math and check it against known
  reference points (e.g. phase ≈ 0 at a known historical new moon).
- **Integration tests** (`__tests__/api`) — the two API routes
  (`/api/geocode`, `/api/natal-chart`), with the external HTTP calls
  mocked. These check that a mocked freeastrologyapi.com response gets
  turned into the right draconic chart and aspects, and that a failed
  upstream call surfaces as a clean error rather than a crash.
- **Component tests** (`__tests__/components`) — light rendering checks on
  the shared Card/Pill/MoonGlyph pieces.
- **E2E tests** (`e2e/`) — Playwright driving a real browser against the
  full app, with Supabase's auth and REST calls intercepted at the network
  boundary (see `e2e/mocks.js`) so they run without a real Supabase project
  or API key.

**Caveat, in the same spirit as the natal-chart API schema note above:** I
wrote and reasoned through every test here, but this sandbox has no network
access, so I couldn't run `npm install` or actually execute the suite
end-to-end before handing it to you. The unit tests I'm confident in — they
only depend on the math in `lib/astro.js` and `lib/timezone.js`, which I
traced through by hand. The e2e mocks are built from Supabase's documented
response shapes rather than a live project, so if one fails after your
first real `npm run test:e2e`, start by checking `e2e/mocks.js` against
what your actual Supabase project sends back (browser devtools → Network
tab is the fastest way to check). Run `npm test` right after `npm install`
as your first sanity check — that layer has no external dependencies to
drift.

## What's not in here

- SVG chart wheel rendering (data is shown as tables, not a visual wheel)
- Multi-language support
- Transit forecasts beyond the current-moment moon-to-natal-moon aspect
