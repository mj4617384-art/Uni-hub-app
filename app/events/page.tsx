"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  event_time: string | null;
};

export default function EventsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [rsvpedIds, setRsvpedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/auth");
        return;
      }
      setUserId(userData.user.id);

      let query = supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });

      if (search.trim()) {
        query = query.ilike("title", `%${search.trim()}%`);
      }

      const { data: eventsData } = await query;
      setEvents(eventsData ?? []);

      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("event_id")
        .eq("user_id", userData.user.id);
      setRsvpedIds(new Set((rsvps ?? []).map((r) => r.event_id)));

      setLoading(false);
    }
    load();
  }, [search, router]);

  async function toggleRsvp(eventId: string) {
    if (!userId) return;
    const isRsvped = rsvpedIds.has(eventId);

    if (isRsvped) {
      await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId);
      setRsvpedIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    } else {
      await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: userId });
      setRsvpedIds((prev) => new Set(prev).add(eventId));
    }
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold">Events</h1>
          <p className="text-sm text-hub-textDim">See what&apos;s happening on campus.</p>
        </div>
      </div>

      <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card2 px-4 py-3">
        <SearchIcon />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-hub-textDim"
        />
        <FilterIcon />
      </div>

      <div className="mx-5 mt-6">
        <h2 className="mb-3 text-sm font-medium text-hub-textDim">Upcoming Events</h2>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
          </div>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-hub-textDim">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                isRsvped={rsvpedIds.has(ev.id)}
                onToggleRsvp={() => toggleRsvp(ev.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-5 right-5">
        <button
          onClick={() => router.push("/events/create")}
          className="w-full rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white"
        >
          + Create Event
        </button>
      </div>

      <BottomNav />
    </main>
  );
}

function EventRow({
  event,
  isRsvped,
  onToggleRsvp,
}: {
  event: Event;
  isRsvped: boolean;
  onToggleRsvp: () => void;
}) {
  const date = new Date(event.event_date);
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = date.getDate();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-card p-3.5">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-hub-card2 text-hub-accentLight">
        <span className="text-[10px] font-medium leading-none">{month}</span>
        <span className="text-base font-semibold leading-tight">{day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="truncate text-xs text-hub-textDim">
          {[event.location, event.event_time].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button onClick={onToggleRsvp} aria-label="RSVP">
        <BookmarkIcon filled={isRsvped} />
      </button>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-hub-textDim shrink-0">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-hub-textDim shrink-0">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className="text-hub-accentLight shrink-0">
      <path d="M6 4h12v16l-6-4-6 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
