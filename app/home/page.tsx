"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import SidebarMenu from "@/components/SidebarMenu";

type Service = {
  label: string;
  sub: string;
  href: string;
  icon: JSX.Element;
};

type RecentPost = {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  first_name?: string;
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

const CAMPUS_GATE_IMAGE_URL =
  "https://lrzsycbqaxhmikvddese.supabase.co/storage/v1/object/public/marketplace-images/IMG-20260813-WA0037%282%29.jpg";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [eventsToday, setEventsToday] = useState<number>(0);
  const [communitiesCount, setCommunitiesCount] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, department")
        .eq("id", data.user.id)
        .single();
      setFirstName(profile?.first_name ?? null);
      setDepartment(profile?.department ?? null);
      await Promise.all([
        loadRecentPosts(),
        loadStats(data.user.id),
      ]);
      setLoading(false);
    }
    loadUser();
  }, [router]);

  async function loadStats(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [eventsRes, communitiesRes, walletRes] = await Promise.all([
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString()),
      supabase
        .from("communities")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single(),
    ]);

    if (!eventsRes.error) setEventsToday(eventsRes.count ?? 0);
    if (!communitiesRes.error) setCommunitiesCount(communitiesRes.count ?? 0);
    if (!walletRes.error && walletRes.data) setWalletBalance(Number(walletRes.data.balance));
  }

  async function loadRecentPosts() {
    const { data, error } = await supabase
      .from("discover_posts")
      .select("id, content, image_url, created_at, profiles(first_name)")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error(error);
      return;
    }

    const mapped = (data ?? []).map((p: any) => ({
      id: p.id,
      content: p.content,
      image_url: p.image_url,
      created_at: p.created_at,
      first_name: p.profiles?.first_name ?? "Student",
    }));
    setRecentPosts(mapped);
  }

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-hub-border bg-hub-card text-hub-textDim"
          >
            <MenuIcon />
          </button>
          <h1 className="text-xl font-semibold">
            Uni<span className="text-hub-accentLight">.hub</span>
          </h1>
        </div>
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

      <SidebarMenu
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        firstName={firstName}
        department={department}
      />

      {/* Greeting card — solid navy on the left blending into the campus photo on the right */}
      <div
        className="relative mx-5 mt-5 overflow-hidden rounded-2xl p-5 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to right, #0A0F1E 35%, rgba(10,15,30,0.55) 65%, rgba(10,15,30,0.15) 100%), url(${CAMPUS_GATE_IMAGE_URL})`,
        }}
      >
        <div className="relative max-w-[75%]">
          <p className="text-lg font-medium text-white">
            {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
          </p>
          <p className="mt-1 text-sm text-white/80">
            Here&apos;s what&apos;s happening around your campus.
          </p>
          <div className="mt-2 h-0.5 w-10 rounded-full bg-hub-accentLight" />
        </div>
      </div>

      {/* Stats row */}
      <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
        <button
          onClick={() => router.push("/events")}
          className="flex flex-col items-start gap-1 rounded-xl border border-hub-border bg-hub-card p-3 text-left"
        >
          <span className="text-hub-accentLight"><CalendarIcon /></span>
          <span className="text-base font-semibold text-white">{eventsToday}</span>
          <span className="text-[11px] text-hub-textDim">Events today</span>
        </button>
        <button
          onClick={() => router.push("/communities")}
          className="flex flex-col items-start gap-1 rounded-xl border border-hub-border bg-hub-card p-3 text-left"
        >
          <span className="text-hub-accentLight"><UsersIcon /></span>
          <span className="text-base font-semibold text-white">{communitiesCount}</span>
          <span className="text-[11px] text-hub-textDim">Communities</span>
        </button>
        <button
          onClick={() => router.push("/wallet")}
          className="flex flex-col items-start gap-1 rounded-xl border border-hub-border bg-hub-card p-3 text-left"
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-hub-accentLight"><WalletIcon /></span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBalance((s) => !s);
              }}
              aria-label="Toggle balance visibility"
              className="text-hub-textDim"
            >
              <EyeIcon show={showBalance} />
            </button>
          </div>
          <span className="text-base font-semibold text-white">
            {showBalance ? `₦${(walletBalance ?? 0).toLocaleString()}` : "₦••••••"}
          </span>
          <span className="text-[11px] text-hub-textDim">Wallet balance</span>
        </button>
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

      {/* Post composer */}
      <div className="mx-5 mt-6">
        <div className="rounded-xl border border-hub-border bg-hub-card p-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 text-left"
            onClick={() => router.push("/discover")}
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
              {firstName ? firstName.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="text-sm text-hub-textDim">What&apos;s happening on campus?</span>
          </button>
          <div className="mt-3 flex items-center gap-5 border-t border-hub-border pt-3">
            <button
              type="button"
              onClick={() => router.push("/discover?compose=photo")}
              className="flex items-center gap-1.5 text-xs text-hub-textDim"
            >
              <PhotoIcon />
              Photo
            </button>
            <button
              type="button"
              onClick={() => router.push("/discover?compose=video")}
              className="flex items-center gap-1.5 text-xs text-hub-textDim"
            >
              <VideoIcon />
              Video
            </button>
            <button
              type="button"
              onClick={() => router.push("/create-poll")}
              className="flex items-center gap-1.5 text-xs text-hub-textDim"
            >
              <PollIcon />
              Poll
            </button>
          </div>
        </div>
      </div>

      {/* Recent Updates — now pulled live from Discover */}
      <div className="mx-5 mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-hub-textDim">Recent Updates</h2>
          {recentPosts.length > 0 && (
            <button
              onClick={() => router.push("/discover")}
              className="text-xs text-hub-accentLight"
            >
              See all
            </button>
          )}
        </div>

        {recentPosts.length === 0 ? (
          <div className="rounded-xl border border-hub-border bg-hub-card p-4 text-sm text-hub-textDim">
            Campus updates will show up here once someone posts on Discover.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => router.push("/discover")}
                className="flex items-start gap-3 rounded-xl border border-hub-border bg-hub-card p-3 text-left"
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                  {post.first_name?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">
                    {post.first_name}
                    <span className="ml-2 font-normal text-hub-textDim">
                      {timeAgo(post.created_at)}
                    </span>
                  </p>
                  {post.content && (
                    <p className="mt-0.5 truncate text-xs text-hub-textDim">
                      {post.content}
                    </p>
                  )}
                </div>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4.5 10 8-.31.99-.84 2.02-1.56 3M6.6 6.6C4.3 8.05 2.6 10.2 2 12c1 3.5 5 8 10 8 1.35 0 2.63-.28 3.78-.78" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
function PhotoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function PollIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 20V10M12 20V4M19 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
