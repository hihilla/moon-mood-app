"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUtcOffsetHours } from "@/lib/timezone";
import { COLORS } from "@/lib/theme";
import { Card } from "@/components/ui";
import AuthGate from "@/components/AuthGate";

function OnboardingForm({ session }) {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("12:00");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [place, setPlace] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const searchPlace = async () => {
    if (placeQuery.trim().length < 2) return;
    setSearching(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(placeQuery)}`);
    const data = await res.json();
    setPlaceResults(data.results || []);
    setSearching(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!place || !birthDate) {
      setError("Pick a birth date and a place from the search results.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const [y, m, d] = birthDate.split("-").map(Number);
      const [hh, mm] = birthTime.split(":").map(Number);
      const birthDateObj = new Date(Date.UTC(y, m - 1, d, hh, mm));
      const tzOffset = getUtcOffsetHours(birthDateObj, place.timezone);

      const payload = {
        year: y,
        month: m,
        date: d,
        hours: hh,
        minutes: mm,
        seconds: 0,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: tzOffset,
      };

      const res = await fetch("/api/natal-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const chart = await res.json();
      if (chart.error) throw new Error(chart.error);

      const { error: dbError } = await supabase.from("profiles").upsert({
        user_id: session.user.id,
        birth_date: birthDate,
        birth_time: birthTime,
        birth_place: `${place.name}${place.country ? ", " + place.country : ""}`,
        birth_lat: place.latitude,
        birth_lng: place.longitude,
        birth_tz_offset: tzOffset,
        natal_chart: chart,
      });
      if (dbError) throw dbError;

      setDone(true);
      setTimeout(() => (window.location.href = "/"), 1200);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-24">
      <div className="serif text-3xl mb-1">Your birth chart</div>
      <div className="text-sm mb-6" style={{ color: COLORS.inkSoft }}>
        Used once to calculate your natal chart. Time and place accuracy matters — an
        unknown birth time will shift your Ascendant and house placements.
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Card>
          <label className="text-sm font-medium block mb-1" style={{ color: COLORS.inkSoft }}>Birth date</label>
          <input
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-lg p-3 text-sm outline-none"
            style={{ border: `1px solid ${COLORS.line}` }}
          />
        </Card>

        <Card>
          <label className="text-sm font-medium block mb-1" style={{ color: COLORS.inkSoft }}>Birth time</label>
          <input
            type="time"
            required
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            className="w-full rounded-lg p-3 text-sm outline-none"
            style={{ border: `1px solid ${COLORS.line}` }}
          />
        </Card>

        <Card>
          <label className="text-sm font-medium block mb-1" style={{ color: COLORS.inkSoft }}>Birth place</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="City, country"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              className="flex-1 rounded-lg p-3 text-sm outline-none"
              style={{ border: `1px solid ${COLORS.line}` }}
            />
            <button
              type="button"
              onClick={searchPlace}
              className="px-4 rounded-lg text-sm"
              style={{ background: COLORS.ink, color: COLORS.bg }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
          {placeResults.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {placeResults.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => { setPlace(r); setPlaceResults([]); setPlaceQuery(`${r.name}, ${r.country}`); }}
                  className="text-left text-sm px-3 py-2 rounded-lg"
                  style={{ border: `1px solid ${COLORS.line}` }}
                >
                  {r.name}{r.admin1 ? `, ${r.admin1}` : ""}, {r.country}
                  <span className="mono block text-xs" style={{ color: COLORS.inkSoft }}>{r.timezone}</span>
                </button>
              ))}
            </div>
          )}
          {place && (
            <div className="mt-2 text-xs mono" style={{ color: COLORS.sage }}>
              Selected: {place.name}, {place.country} ({place.timezone})
            </div>
          )}
        </Card>

        {error && <div className="text-sm" style={{ color: COLORS.rose }}>{error}</div>}

        <button
          type="submit"
          disabled={saving || done}
          className="w-full py-3 rounded-xl text-sm font-medium"
          style={{ background: COLORS.ink, color: COLORS.bg }}
        >
          {done ? "Saved — redirecting…" : saving ? "Calculating chart…" : "Generate my chart"}
        </button>
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  return <AuthGate>{(session) => <OnboardingForm session={session} />}</AuthGate>;
}
