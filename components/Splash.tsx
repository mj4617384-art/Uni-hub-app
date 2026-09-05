"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/onboarding");
    }, 1600);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="relative flex h-screen flex-col items-center justify-center gap-6 bg-hub-bg px-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-white">
        Uni<span className="text-hub-accentLight">Hub</span>
      </h1>
      <p className="-mt-4 text-sm text-hub-textDim">Connect. Learn. Grow.</p>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
    </main>
  );
}
