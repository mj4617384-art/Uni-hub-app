"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ThemePreference = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";
type ThemeContextValue = {
  theme: ResolvedTheme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setThemePreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("dark");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");
  const [userId, setUserId] = useState<string | null>(null);

  function applyPreference(pref: ThemePreference) {
    const resolved = resolve(pref);
    setPreference(pref);
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }

  useEffect(() => {
    // Always paint dark first — no one's preference is known yet.
    document.documentElement.setAttribute("data-theme", "dark");

    async function loadForUser(id: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", id)
        .single();
      const stored = (profile?.theme_preference as ThemePreference | null) ?? "dark";
      applyPreference(stored);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        loadForUser(data.user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadForUser(session.user.id);
      } else {
        // Logged out — next person on this device should see the default, not the last user's pick.
        setUserId(null);
        applyPreference("dark");
      }
    });

    // If someone's on "system", follow the OS/browser when it changes live
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      setPreference((current) => {
        if (current === "system") {
          const resolved = systemPrefersDark() ? "dark" : "light";
          setTheme(resolved);
          document.documentElement.setAttribute("data-theme", resolved);
        }
        return current;
      });
    }
    mql.addEventListener("change", handleSystemChange);

    return () => {
      listener.subscription.unsubscribe();
      mql.removeEventListener("change", handleSystemChange);
    };
  }, []);

  async function persistPreference(pref: ThemePreference) {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: pref })
      .eq("id", userId);
    if (error) console.error("Failed to save theme preference:", error);
  }

  async function toggleTheme() {
    // Manual toggle cycles between dark/light directly (existing behavior kept as-is)
    const next: ThemePreference = theme === "dark" ? "light" : "dark";
    applyPreference(next);
    await persistPreference(next);
  }

  async function setThemePreference(pref: ThemePreference) {
    applyPreference(pref);
    await persistPreference(pref);
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
