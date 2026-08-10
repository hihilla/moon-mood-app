// Free, keyless geocoding — resolves a typed place name to lat/lng + IANA
// timezone. Used during onboarding so the person can type "Amsterdam"
// instead of hunting for coordinates.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return Response.json({ results: [] });
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q
  )}&count=5&language=en&format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    return Response.json({ results: [] }, { status: 200 });
  }
  const data = await res.json();
  const results = (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone, // IANA name, e.g. "Europe/Amsterdam"
  }));
  return Response.json({ results });
}
