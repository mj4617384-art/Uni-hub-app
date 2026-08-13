"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/auth");
      return;
    }

    const { error } = await supabase.from("events").insert({
      creator_id: userData.user.id,
      title,
      description: description || null,
      location: location || null,
      event_date: eventDate,
      event_time: eventTime || null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/events");
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pt-5 pb-10">
      <button onClick={() => router.back()} aria-label="Back" className="mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <h1 className="text-xl font-semibold">Create Event</h1>
      <p className="mt-1 text-sm text-hub-textDim">Let your campus know what&apos;s happening.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Event Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Freshers' Welcome Party"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this event about?"
            rows={3}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Location (optional)</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Main Auditorium"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Date</span>
          <input
            required
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Time (optional)</span>
          <input
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            placeholder="e.g. 4:00 PM"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Event"}
        </button>
      </form>
    </main>
  );
}
