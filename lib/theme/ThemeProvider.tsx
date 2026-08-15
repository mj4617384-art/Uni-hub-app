"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Theme = "dark" | "light";
type ThemeContextValue = { theme: Theme; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Always paint dark first — no one's preference is known yet.
    document.documentElement.setAttribute("data-theme", "dark");

    async function loadForUser(id: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", id)
        .single();
      const resolved = (profile?.theme_preference as Theme | null) ?? "dark";
      setTheme(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
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
        setTheme("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);

    if (userId) {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: next })
        .eq("id", userId);
      if (error) console.error("Failed to save theme preference:", error);
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
