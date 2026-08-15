"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="flex items-center gap-2 rounded-lg px-1 py-1"
    >
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-hub-card2 border border-hub-border">
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-hub-accentLight transition-transform ${
            isDark ? "translate-x-0.5" : "translate-x-5"
          }`}
          style={{ height: "18px", width: "18px" }}
        />
      </span>
      <span className="text-xs text-hub-textDim">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
