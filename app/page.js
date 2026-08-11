"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { COLORS, MOOD_TAGS, PHASE_BLURB, SIGN_BLURB } from "@/lib/theme";
import { Card, Pill, MoonGlyph, PlanetReading } from "@/components/ui";
import AuthGate from "@/components/AuthGate";
import {
  moonEclipticLongitude, moonSign, moonPhaseFraction, phaseName, illumination,
  aspectBetween, buildFullHoroscope, dateKey, fmtDate,
} from "@/lib/astro";

const emptyDraft = { moods: [], energy: 3, period: false, cried: false, bloated: false, acne: false, coldSore: false, notes: "" };

function Tracker({ session }) {
  const [profile, setProfile] = useState(undefined);
  const [entries, setEntries] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [transits, setTransits] = useState(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const userId = session.user.id;

  useEffect(() => {
    (async () => {
      const [{ data: profileData }, { data: entryRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("entries").select("*").eq("user_id", userId),
      ]);
      setProfile(profileData || null);

      const map = {};
      (entryRows || []).forEach((row) => {
        map[row.entry_date] = {
          moods: row.moods || [],
          energy: row.energy,
          period: row.period,
          cried: row.cried,
          bloated: row.bloated,
          acne: row.acne,
          coldSore: row.cold_sore,
          notes: row.notes || "",
        };
      });
      setEntries(map);
      if (map[todayKey]) setDraft(map[todayKey]);
      setLoaded(true);
    })();
  }, [userId, todayKey]);

  useEffect(() => {
    if (!profile?.natal_chart) return;
    (async () => {
      try {
        const res = await fetch("/api/transits");
        const data = await res.json();
        if (!data.error) setTransits(data.planets);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [profile?.natal_chart, todayKey]);

  const saveToday = async () => {
    setSaving(true);
    const { error } = await supabase.from("entries").upsert({
      user_id: userId,
      entry_date: todayKey,
      moods: draft.moods,
      energy: draft.energy,
      period: draft.period,
      cried: draft.cried,
      bloated: draft.bloated,
      acne: draft.acne,
      cold_sore: draft.coldSore,
      notes: draft.notes,
    });
    setEntries((prev) => ({ ...prev, [todayKey]: draft }));
    setSaving(false);
    setSaveMsg(error ? "Save failed" : "Saved");
    setTimeout(() => setSaveMsg(""), 1500);
  };

  const deleteEntry = async (key) => {
    await supabase.from("entries").delete().eq("user_id", userId).eq("entry_date", key);
    setEntries((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleMood = (m) => {
    setDraft((d) => (d.moods.includes(m) ? { ...d, moods: d.moods.filter((x) => x !== m) } : { ...d, moods: [...d.moods, m] }));
  };

  const frac = moonPhaseFraction(today);
  const pName = phaseName(frac);
  const sign = moonSign(today);
  const illum = Math.round(illumination(frac) * 100);
  const todayLon = moonEclipticLongitude(today);

  const natalMoon = profile?.natal_chart?.tropical?.planets?.find((p) => p.name === "Moon");
  const transitAspect = natalMoon ? aspectBetween(todayLon, natalMoon.longitude) : null;

  const fullHoroscope = profile?.natal_chart?.tropical
      ? buildFullHoroscope({
        moonLongitude: todayLon,
        transitPlanets: transits,
        natalPlanets: profile.natal_chart.tropical.planets,
        natalHouses: profile.natal_chart.tropical.houses,
      })
      : [];

  const sunReading = fullHoroscope.find((r) => r.planet === "Sun");
  const moonReading = fullHoroscope.find((r) => r.planet === "Moon");
  const otherReadings = fullHoroscope
      .filter((r) => r.planet !== "Sun" && r.planet !== "Moon" && r.topAspect)
      .sort((a, b) => a.topAspect.orb - b.topAspect.orb)
      .slice(0, 2);

  /* ---------- cycle prediction ---------- */
  const cyclePrediction = useMemo(() => {
    const sortedKeys = Object.keys(entries).sort();
    const periodDates = sortedKeys.filter((k) => entries[k].period);
    if (periodDates.length === 0) return null;
    const starts = [];
    periodDates.forEach((k) => {
      const prev = new Date(k + "T12:00:00Z");
      prev.setUTCDate(prev.getUTCDate() - 1);
      const prevKey = dateKey(prev);
      if (!entries[prevKey] || !entries[prevKey].period) starts.push(k);
    });
    if (starts.length < 2) return { cyclesLogged: starts.length };
    const diffs = [];
    for (let i = 1; i < starts.length; i++) {
      const a = new Date(starts[i - 1] + "T12:00:00Z");
      const b = new Date(starts[i] + "T12:00:00Z");
      diffs.push(Math.round((b - a) / 86400000));
    }
    const avgCycle = Math.round(diffs.reduce((s, x) => s + x, 0) / diffs.length);
    const lastStart = new Date(starts[starts.length - 1] + "T12:00:00Z");
    const nextStart = new Date(lastStart);
    nextStart.setUTCDate(nextStart.getUTCDate() + avgCycle);
    const ovulation = new Date(nextStart);
    ovulation.setUTCDate(ovulation.getUTCDate() - 14);
    return {
      cyclesLogged: starts.length,
      confident: starts.length >= 4,
      avgCycle,
      nextStart: dateKey(nextStart),
      ovulation: dateKey(ovulation),
    };
  }, [entries]);

  /* ---------- insights ---------- */
  const insights = useMemo(() => {
    const keys = Object.keys(entries);
    if (keys.length === 0) return null;
    const moodCount = {};
    let energySum = 0, energyN = 0;
    const energyBySign = {};
    keys.forEach((k) => {
      const e = entries[k];
      (e.moods || []).forEach((m) => (moodCount[m] = (moodCount[m] || 0) + 1));
      if (typeof e.energy === "number") {
        energySum += e.energy;
        energyN += 1;
        const s = moonSign(new Date(k + "T12:00:00Z"));
        if (!energyBySign[s]) energyBySign[s] = { sum: 0, n: 0 };
        energyBySign[s].sum += e.energy;
        energyBySign[s].n += 1;
      }
    });
    const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
    const avgEnergy = energyN ? (energySum / energyN).toFixed(1) : null;
    const chartData = Object.keys(energyBySign).map((s) => ({
      sign: s.slice(0, 3),
      avg: +(energyBySign[s].sum / energyBySign[s].n).toFixed(2),
    }));
    return { topMood, avgEnergy, chartData, totalLogs: keys.length };
  }, [entries]);

  const upcoming = useMemo(() => {
    const days = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push({
        key: dateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        sign: moonSign(d),
        phase: phaseName(moonPhaseFraction(d)),
      });
    }
    return days;
  }, [today]);

  const pastEntries = useMemo(() => Object.keys(entries).sort().reverse(), [entries]);

  if (!loaded) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.inkSoft }}>Loading…</div>;
  }

  return (
      <div style={{ minHeight: "100vh" }}>
        <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="mono text-xs tracking-widest uppercase" style={{ color: COLORS.inkSoft }}>personal moon &amp; mood log</div>
              <div className="serif text-3xl">{today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-xs mono" style={{ color: COLORS.inkSoft }}>sign out</button>
          </div>

          {!profile?.natal_chart && (
              <Card style={{ marginBottom: 16 }}>
                <div className="text-sm">
                  Add your birth details to unlock natal-moon comparisons and your full chart.{" "}
                  <Link href="/onboarding" className="underline" style={{ color: COLORS.accent }}>Set up now →</Link>
                </div>
              </Card>
          )}
          {profile?.natal_chart && (
              <div className="mb-4">
                <Link href="/chart" className="text-sm underline" style={{ color: COLORS.accent }}>View your natal chart →</Link>
              </div>
          )}

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {[["today", "Today"], ["log", "Log"], ["insights", "Insights"], ["upcoming", "Upcoming"]].map(([id, label]) => (
                <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap"
                    style={{
                      background: tab === id ? COLORS.ink : "transparent",
                      color: tab === id ? COLORS.bg : COLORS.inkSoft,
                      border: `1px solid ${tab === id ? COLORS.ink : COLORS.line}`,
                    }}
                >
                  {label}
                </button>
            ))}
          </div>

          {tab === "today" && (
              <div className="flex flex-col gap-4">
                <Card>
                  <div className="flex items-center gap-4">
                    <MoonGlyph frac={frac} />
                    <div>
                      <div className="serif text-xl">{pName} in {sign}</div>
                      <div className="text-sm mono" style={{ color: COLORS.inkSoft }}>{illum}% illuminated</div>
                      <div className="text-sm mt-1">{PHASE_BLURB[pName]}</div>
                      <div className="text-sm mt-1">The moon is currently in {sign}, traditionally associated with being {SIGN_BLURB[sign]}.</div>
                      {transitAspect && (
                          <div className="text-sm mt-1" style={{ color: COLORS.accentDeep }}>
                            {transitAspect.type} your natal moon ({natalMoon.sign}) — orb {transitAspect.orb}°
                          </div>
                      )}
                    </div>
                  </div>
                  {(sunReading || moonReading || otherReadings.length > 0) && (
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                        <div className="text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}>
                          Your horoscope today
                          {profile?.natal_chart && !transits && (
                              <span className="mono text-xs" style={{ color: COLORS.inkSoft, marginLeft: 6 }}>(loading full chart…)</span>
                          )}
                        </div>

                        <PlanetReading reading={sunReading} />
                        <PlanetReading reading={moonReading} />

                        {otherReadings.length > 0 && (
                            <div className="mt-1 pt-3" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                              <div className="text-xs font-medium mb-2" style={{ color: COLORS.inkSoft }}>Other planets worth noting</div>
                              {otherReadings.map((r) => (
                                  <PlanetReading key={r.planet} reading={r} />
                              ))}
                            </div>
                        )}
                      </div>
                  )}
                </Card>

                <Card>
                  <div className="text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}>How are you feeling?</div>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_TAGS.map((m) => (
                        <Pill key={m} active={draft.moods.includes(m)} onClick={() => toggleMood(m)}>{m}</Pill>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: COLORS.inkSoft }}>Energy</span>
                    <span className="mono text-sm">{draft.energy}/5</span>
                  </div>
                  <input type="range" min="1" max="5" value={draft.energy} onChange={(e) => setDraft((d) => ({ ...d, energy: +e.target.value }))} className="w-full" />
                </Card>

                <Card>
                  <div className="flex flex-wrap gap-2">
                    {[["period", "Period", COLORS.rose], ["cried", "Cried", COLORS.accent], ["bloated", "Bloated", COLORS.sage], ["acne", "Acne", COLORS.gold], ["coldSore", "Cold Sore", COLORS.accentDeep]].map(([key, label, color]) => (
                        <button
                            key={key}
                            onClick={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
                            className="px-3 py-1.5 rounded-full text-sm"
                            style={{
                              border: `1px solid ${draft[key] ? color : COLORS.line}`,
                              background: draft[key] ? color : "transparent",
                              color: draft[key] ? "#fff" : COLORS.ink,
                            }}
                        >
                          {label}
                        </button>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="text-sm font-medium mb-2" style={{ color: COLORS.inkSoft }}>Notes</div>
                  <textarea
                      value={draft.notes}
                      onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                      placeholder="Anything that happened today…"
                      rows={3}
                      className="w-full rounded-lg p-3 text-sm outline-none"
                      style={{ border: `1px solid ${COLORS.line}`, background: "#fff" }}
                  />
                </Card>

                <button onClick={saveToday} disabled={saving} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: COLORS.ink, color: COLORS.bg }}>
                  {saving ? "Saving…" : saveMsg || "Save today's entry"}
                </button>
              </div>
          )}

          {tab === "log" && (
              <div className="flex flex-col gap-3">
                {pastEntries.length === 0 && <Card><div className="text-sm" style={{ color: COLORS.inkSoft }}>No entries yet — log today to start your history.</div></Card>}
                {pastEntries.map((key) => {
                  const e = entries[key];
                  return (
                      <Card key={key}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="mono text-xs" style={{ color: COLORS.inkSoft }}>{fmtDate(key)}</div>
                            <div className="text-sm mt-1">
                              {(e.moods || []).join(", ") || "—"}
                              {typeof e.energy === "number" && <span className="mono" style={{ color: COLORS.inkSoft }}> · energy {e.energy}/5</span>}
                            </div>
                            <div className="flex gap-1.5 mt-1.5">
                              {e.period && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORS.rose, color: "#fff" }}>period</span>}
                              {e.cried && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORS.accent, color: "#fff" }}>cried</span>}
                              {e.bloated && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORS.sage, color: "#fff" }}>bloated</span>}
                              {e.acne && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORS.gold, color: "#fff" }}>acne</span>}
                              {e.coldSore && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORS.accentDeep, color: "#fff" }}>cold sore</span>}
                            </div>
                            {e.notes && <div className="text-sm mt-2">{e.notes}</div>}
                          </div>
                          <button onClick={() => deleteEntry(key)} className="text-xs mono" style={{ color: COLORS.inkSoft }}>delete</button>
                        </div>
                      </Card>
                  );
                })}
              </div>
          )}

          {tab === "insights" && (
              <div className="flex flex-col gap-4">
                <Card>
                  <div className="serif text-lg mb-1">Cycle estimate</div>
                  {!cyclePrediction && <div className="text-sm" style={{ color: COLORS.inkSoft }}>Log a period day to start tracking your cycle.</div>}
                  {cyclePrediction && !cyclePrediction.nextStart && (
                      <div className="text-sm" style={{ color: COLORS.inkSoft }}>{cyclePrediction.cyclesLogged} period start logged — log one more cycle to get an estimate.</div>
                  )}
                  {cyclePrediction?.nextStart && (
                      <div className="text-sm flex flex-col gap-1">
                        <div>Average cycle length: <span className="mono">{cyclePrediction.avgCycle} days</span></div>
                        <div>Next period (est.): <span className="mono">{fmtDate(cyclePrediction.nextStart)}</span></div>
                        <div>Fertile window peak (est.): <span className="mono">{fmtDate(cyclePrediction.ovulation)}</span></div>
                        <div className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
                          Based on {cyclePrediction.cyclesLogged} logged cycles{!cyclePrediction.confident && " — accuracy improves after 4"}. Calendar-based estimate only; use BBT or ovulation strips to confirm ovulation.
                        </div>
                      </div>
                  )}
                </Card>

                {insights && (
                    <>
                      <Card>
                        <div className="serif text-lg mb-1">Patterns</div>
                        <div className="text-sm">
                          {insights.topMood && <div>Most logged mood: <b>{insights.topMood[0]}</b> ({insights.topMood[1]}×)</div>}
                          {insights.avgEnergy && <div>Average energy: <span className="mono">{insights.avgEnergy}/5</span></div>}
                          <div className="mt-1" style={{ color: COLORS.inkSoft }}>{insights.totalLogs} total logs</div>
                        </div>
                      </Card>

                      {insights.chartData.length > 1 && (
                          <Card>
                            <div className="text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}>Energy by moon sign</div>
                            <div style={{ width: "100%", height: 180 }}>
                              <ResponsiveContainer>
                                <BarChart data={insights.chartData}>
                                  <CartesianGrid stroke={COLORS.line} vertical={false} />
                                  <XAxis dataKey="sign" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={24} />
                                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                                    {insights.chartData.map((_, i) => <Cell key={i} fill={COLORS.accent} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </Card>
                      )}
                    </>
                )}
              </div>
          )}

          {tab === "upcoming" && (
              <div className="flex flex-col gap-2">
                {upcoming.map((d) => (
                    <div key={d.key} className="flex items-center justify-between py-2 px-1" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                      <span className="text-sm">{d.label}</span>
                      <span className="text-sm mono" style={{ color: COLORS.inkSoft }}>{d.phase} · {d.sign}</span>
                    </div>
                ))}
              </div>
          )}
        </div>
      </div>
  );
}

export default function Home() {
  return <AuthGate>{(session) => <Tracker session={session} />}</AuthGate>;
}