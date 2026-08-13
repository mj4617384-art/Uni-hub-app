"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Service = {
  label: string;
  sub: string;
  href: string;
  icon: JSX.Element;
};

const services: Service[] = [
  { label: "Errands", sub: "Get things done", href: "/errands", icon: <BriefcaseIcon /> },
  { label: "Marketplace", sub: "Buy & sell", href: "/marketplace", icon: <BagIcon /> },
  { label: "Wallet", sub: "Pay & manage", href: "/wallet", icon: <WalletIcon /> },
  { label: "Study Hub", sub: "Notes & resources", href: "/study-hub", icon: <BookIcon /> },
  { label: "Events", sub: "What's coming up", href: "/events", icon: <CalendarIcon /> },
  { label: "Communities", sub: "Join & connect", href: "/communities", icon: <UsersIcon /> },
];

const trendingTags = ["#Freshers2026", "#ExamsSZN", "#HostelLife", "#CampusVibes"];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", data.user.id)
        .single();
      setFirstName(profile?.first_name ?? null);
      setLoading(false);
    }
    loadUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5">
        <h1 className="text-xl font-semibold">
          Uni<span className="text-hub-accentLight">.hub</span>
        </h1>
        <div className="flex items-center gap-4 text-hub-textDim">
          <SearchIcon />
          <div className="relative">
            <BellIcon />
          </div>
          <button onClick={() => router.push("/profile")} aria-label="Profile">
            <div className="h-8 w-8 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
              {firstName ? firstName.charAt(0).toUpperCase() : "U"}
            </div>
          </button>
        </div>
      </div>

      {/* Greeting card */}
      <div className="mx-5 mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#16244a] to-hub-card p-5">
        <p className="text-lg font-medium">
          {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
        </p>
        <p className="mt-1 text-sm text-hub-textDim">
          Here&apos;s what&apos;s happening around your campus.
        </p>
      </div>

      {/* Campus Services grid */}
      <div className="mx-5 mt-6">
        <h2 className="mb-3 text-sm font-medium text-hub-textDim">Campus Services</h2>
        <div className="grid grid-cols-2 gap-3">
          {services.map((s) => (
            <button
              key={s.label}
              onClick={() => router.push(s.href)}
              className="flex flex-col items-start gap-2 rounded-xl border border-hub-border bg-hub-card p-4 text-left"
            >
              <span className="text-hub-accentLight">{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-hub-textDim">{s.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trending on Campus */}
      <div className="mt-6">
        <div className="mx-5 mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-hub-textDim">Trending on Campus</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
          {trendingTags.map((tag) => (
            <span
              key={tag}
              className="shrink-0 rounded-full border border-hub-border bg-hub-card px-3 py-1.5 text-xs text-hub-accentLight"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Recent Updates (placeholder until Discover feed is built) */}
      <div className="mx-5 mt-6">
        <h2 className="mb-3 text-sm font-medium text-hub-textDim">Recent Updates</h2>
        <div className="rounded-xl border border-hub-border bg-hub-card p-4 text-sm text-hub-textDim">
          Campus updates will show up here once Discover is live.
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 8h12l-1 12H7L6 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 13h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 16.5v-11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 16.5A2.5 2.5 0 006.5 19H20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 19c1-3.2 4-4.5 6.5-4.5s5.5 1.3 6.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 14.2c2 .3 3.7 1.5 4.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
