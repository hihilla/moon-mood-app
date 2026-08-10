"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { COLORS } from "@/lib/theme";
import { Card } from "@/components/ui";
import AuthGate from "@/components/AuthGate";

function ChartView({ session }) {
  const [profile, setProfile] = useState(undefined);
  const [zodiac, setZodiac] = useState("tropical");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setProfile(data || null);
    })();
  }, [session.user.id]);

  if (profile === undefined) {
    return <div className="p-6 text-sm" style={{ color: COLORS.inkSoft }}>Loading…</div>;
  }

  if (!profile || !profile.natal_chart) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10">
        <div className="serif text-2xl mb-2">No chart yet</div>
        <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
          Add your birth date, time, and place to generate your natal chart.
        </p>
        <Link href="/onboarding" className="underline text-sm" style={{ color: COLORS.accent }}>
          Set up my chart →
        </Link>
      </div>
    );
  }

  const chart = profile.natal_chart;
  const planets = zodiac === "draconic" ? chart.draconic.planets : chart[zodiac]?.planets || [];
  const houses = zodiac === "draconic" ? null : chart[zodiac]?.houses || [];

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
      <Link href="/" className="text-sm mono" style={{ color: COLORS.inkSoft }}>← back</Link>
      <div className="serif text-3xl mt-2 mb-1">Your chart</div>
      <div className="text-sm mb-6" style={{ color: COLORS.inkSoft }}>
        {profile.birth_place} · {profile.birth_date} · {profile.birth_time}
      </div>

      <div className="flex gap-2 mb-5">
        {["tropical", "sidereal", "draconic"].map((z) => (
          <button
            key={z}
            onClick={() => setZodiac(z)}
            className="px-3.5 py-1.5 rounded-full text-sm capitalize"
            style={{
              background: zodiac === z ? COLORS.ink : "transparent",
              color: zodiac === z ? COLORS.bg : COLORS.inkSoft,
              border: `1px solid ${zodiac === z ? COLORS.ink : COLORS.line}`,
            }}
          >
            {z}
          </button>
        ))}
      </div>

      {zodiac === "draconic" && (
        <div className="text-xs mb-4 mono" style={{ color: COLORS.inkSoft }}>
          Draconic = your tropical chart rotated so the True Node sits at 0° Aries. No house data for this one.
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div className="text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}>Planets</div>
        <div className="flex flex-col gap-2">
          {planets.map((p) => (
            <div key={p.name} className="flex justify-between text-sm">
              <span>{p.name}{p.retrograde ? " ℞" : ""}</span>
              <span className="mono" style={{ color: COLORS.inkSoft }}>{p.sign} · {(p.longitude % 30).toFixed(1)}°</span>
            </div>
          ))}
        </div>
      </Card>

      {houses && houses.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div className="text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}>Houses (Placidus)</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {houses.map((h) => (
              <div key={h.house} className="flex justify-between text-sm">
                <span>House {h.house}</span>
                <span className="mono" style={{ color: COLORS.inkSoft }}>{h.sign}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {zodiac === "tropical" && chart.aspects?.length > 0 && (
        <Card>
          <div className="text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}>Aspects</div>
          <div className="flex flex-col gap-1.5">
            {chart.aspects.map((a, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{a.a} {a.type} {a.b}</span>
                <span className="mono text-xs" style={{ color: COLORS.inkSoft }}>orb {a.orb}°</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ChartPage() {
  return <AuthGate>{(session) => <ChartView session={session} />}</AuthGate>;
}
