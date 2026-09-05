"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SLIDE_COUNT = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);

  function goNext() {
    if (slide < SLIDE_COUNT - 1) setSlide(slide + 1);
    else router.push("/auth");
  }

  function skip() {
    router.push("/auth");
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-hub-bg">
      <div className="flex items-center justify-end px-5 pt-4">
        <button onClick={skip} className="text-sm text-hub-textDim">
          Skip
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {slide === 0 && <SlideOne />}
        {slide === 1 && <SlideTwo />}
        {slide === 2 && <SlideThree />}
      </div>

      <div className="px-6 pb-8 pt-4">
        <div className="mb-5 flex items-center justify-center gap-1.5">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === slide ? "w-5 bg-hub-accentLight" : "w-1.5 bg-hub-border"
              }`}
            />
          ))}
        </div>
        <button
          onClick={goNext}
          className="w-full rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white"
        >
          Get Started
        </button>
        <p className="mt-4 text-center text-sm text-hub-textDim">
          Already have an account?{" "}
          <button onClick={() => router.push("/auth")} className="text-hub-accentLight">
            Log in
          </button>
        </p>
      </div>
    </main>
  );
}

function SlideOne() {
  return (
    <div className="flex h-full flex-col px-6 pt-2">
      <h2 className="text-3xl font-semibold leading-tight text-white">
        Your Campus.
        <br />
        Your Community.
        <br />
        Your <span className="text-hub-accentLight">Hub.</span>
      </h2>
      <p className="mt-4 text-sm text-hub-textDim">
        Join a community of students, discover opportunities and achieve more together.
      </p>
      <div className="relative mt-6 flex-1 overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1758270704689-2850704b7338?w=900&q=80&auto=format&fit=crop"
          alt="Students together on campus"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-hub-bg via-transparent to-transparent" />
      </div>
    </div>
  );
}

function SlideTwo() {
  const cards = [
    { icon: "🕒", tint: "bg-purple-500/20 text-purple-300", title: "Upcoming Events", sub: "Tech Hangout · May 24, 10:00 AM", badge: "Going" },
    { icon: "💼", tint: "bg-green-500/20 text-green-300", title: "Internship", sub: "UI/UX Design Intern · Lagos, Nigeria" },
    { icon: "📚", tint: "bg-orange-500/20 text-orange-300", title: "Study Resources", sub: "Database System · Notes & Past Questions" },
  ];
  return (
    <div className="flex h-full flex-col px-6 pt-2">
      <h2 className="text-3xl font-semibold leading-tight text-white">
        Discover
        <br />
        <span className="text-hub-accentLight">Opportunities</span>
        <br />
        Around You
      </h2>
      <p className="mt-4 text-sm text-hub-textDim">
        Find events, internships, part-time jobs, and useful resources.
      </p>
      <div className="mt-6 flex flex-1 flex-col justify-center gap-3">
        {cards.map((c) => (
          <div key={c.title} className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-card px-4 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${c.tint}`}>
              {c.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{c.title}</p>
              <p className="truncate text-xs text-hub-textDim">{c.sub}</p>
            </div>
            {c.badge && (
              <span className="shrink-0 rounded-full bg-hub-accent px-2.5 py-1 text-[11px] font-medium text-white">
                {c.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideThree() {
  const posts = [
    { name: "Alex Moore", time: "2h ago", text: "Just shared a new study guide for Data Structures!", likes: "1.2K", comments: 86, shares: 124 },
    { name: "Sarah James", time: "1h ago", text: "Thanks! This really helped 🔥" },
  ];
  return (
    <div className="flex h-full flex-col px-6 pt-2">
      <h2 className="text-3xl font-semibold leading-tight text-white">
        Share.
        <br />
        <span className="text-hub-accentLight">Learn.</span>
        <br />
        Grow Together.
      </h2>
      <p className="mt-4 text-sm text-hub-textDim">
        Share your ideas, help others, and grow in a supportive student community.
      </p>
      <div className="mt-6 flex flex-1 flex-col justify-center gap-3">
        {posts.map((p, i) => (
          <div key={p.name} className="rounded-xl border border-hub-border bg-hub-card p-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: i === 0 ? "#4C8CFF" : "#E1306C" }}
              >
                {p.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">{p.name}</p>
                <p className="text-[11px] text-hub-textDim">{p.time}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/90">{p.text}</p>
            {p.likes && (
              <div className="mt-2 flex items-center gap-3 text-[11px] text-hub-textDim">
                <span>❤️ {p.likes}</span>
                <span>💬 {p.comments}</span>
                <span>↗ {p.shares}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
