"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { COLORS } from "@/lib/theme";
import { Card } from "@/components/ui";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setError(error.message);
    setBusy(false);
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.inkSoft }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }} className="px-4">
        <div className="w-full max-w-sm">
          <div className="serif text-2xl mb-1">Moon &amp; Mood</div>
          <div className="text-sm mb-6" style={{ color: COLORS.inkSoft }}>
            {mode === "signin" ? "Sign in to your private log." : "This is just for you — pick any email and password."}
          </div>
          <Card>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg p-3 text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}` }}
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg p-3 text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}` }}
              />
              {error && <div className="text-sm" style={{ color: COLORS.rose }}>{error}</div>}
              <button
                type="submit"
                disabled={busy}
                className="py-2.5 rounded-xl text-sm font-medium"
                style={{ background: COLORS.ink, color: COLORS.bg }}
              >
                {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </Card>
          <button
            className="text-sm mt-4 mono"
            style={{ color: COLORS.inkSoft }}
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "First time here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return children(session);
}
