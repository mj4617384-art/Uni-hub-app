"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CampusSkyline from "./CampusSkyline";

type Stage = "splash" | "initializing" | "loading" | "ready";

const STAGE_DURATIONS: Record<Stage, number> = {
  splash: 900,
  initializing: 700,
  loading: 1100,
  ready: 700,
};

export default function Splash() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("splash");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const order: Stage[] = ["splash", "initializing", "loading", "ready"];
    const currentIndex = order.indexOf(stage);
    const timer = setTimeout(() => {
      if (currentIndex < order.length - 1) {
        setStage(order[currentIndex + 1]);
      } else {
        router.push("/auth");
      }
    }, STAGE_DURATIONS[stage]);
    return () => clearTimeout(timer);
  }, [stage, router]);

  useEffect(() => {
    if (stage !== "loading") return;
    setProgress(0);
    const start = Date.now();
    const raf = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / STAGE_DURATIONS.loading) * 100));
      setProgress(pct);
    }, 50);
    return () => clearInterval(raf);
  }, [stage]);

  return (
    <main className="relative flex h-screen flex-col items-center justify-between overflow-hidden bg-hub-bg">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Uni<span className="text-hub-accentLight">.hub</span>
        </h1>

        {stage === "splash" && (
          <p className="text-hub-textDim text-sm">Your campus. Connected.</p>
        )}

        {stage === "initializing" && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
            <p className="text-hub-textDim text-sm">Initializing...</p>
          </div>
        )}

        {stage === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1E2A45" strokeWidth="4" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#4C8CFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - progress / 100)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                {progress}%
              </span>
            </div>
            <p className="text-hub-textDim text-sm">Loading your campus...</p>
          </div>
        )}

        {stage === "ready" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-hub-accentLight">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#4C8CFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-hub-textDim text-sm">Welcome back!</p>
          </div>
        )}
      </div>

      <CampusSkyline className="h-40 w-full opacity-80" />
    </main>
  );
}
