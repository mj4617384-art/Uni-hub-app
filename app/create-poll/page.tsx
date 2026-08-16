"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const DURATION_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

const MAX_QUESTION_LEN = 120;

export default function CreatePollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowAddOptions, setAllowAddOptions] = useState(false);
  const [durationHours, setDurationHours] = useState(24);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearAll() {
    setQuestion("");
    setOptions(["", ""]);
    setAllowMultiple(false);
    setAllowAddOptions(false);
    setDurationHours(24);
    setError(null);
  }

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const canPost = question.trim().length > 0 && trimmedOptions.length >= 2 && !posting;

  async function handlePost() {
    if (!canPost) return;
    setPosting(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/auth");
      return;
    }

    const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const { data: poll, error: pollErr } = await supabase
      .from("polls")
      .insert({
        user_id: userData.user.id,
        question: question.trim(),
        allow_multiple: allowMultiple,
        allow_add_options: allowAddOptions,
        duration_hours: durationHours,
        ends_at: endsAt,
      })
      .select()
      .single();

    if (pollErr || !poll) {
      setError("Failed to create poll: " + (pollErr?.message ?? "unknown error"));
      setPosting(false);
      return;
    }

    const optionRows = trimmedOptions.map((label, i) => ({
      poll_id: poll.id,
      label,
      position: i,
    }));

    const { error: optErr } = await supabase.from("poll_options").insert(optionRows);

    if (optErr) {
      setError("Poll created but options failed: " + optErr.message);
      setPosting(false);
      return;
    }

    setPosting(false);
    router.back();
  }

  return (
    <main className="min-h-screen bg-hub-bg">
      <div className="flex items-center justify-between border-b border-hub-border px-5 py-4">
        <button onClick={() => router.back()} className="text-xl text-hub-textDim">
          ×
        </button>
        <p className="text-sm font-semibold text-white">Create Poll</p>
        <button onClick={clearAll} className="text-sm text-hub-accentLight">
          Clear
        </button>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs text-hub-textDim">Ask your campus a question</p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LEN))}
          placeholder="What's your poll question?"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-hub-border bg-hub-card p-3 text-sm text-white placeholder:text-hub-textDim outline-none"
        />
        <p className="mt-1 text-right text-[11px] text-hub-textDim">
          {question.length}/{MAX_QUESTION_LEN}
        </p>

        <p className="mt-4 text-xs font-medium text-hub-textDim">Poll options</p>
        <div className="mt-2 flex flex-col gap-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-xs text-hub-textDim">{i + 1}</span>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-lg border border-hub-border bg-hub-card px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
              />
              <button
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                className="shrink-0 text-hub-textDim disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {options.length < 8 && (
          <button onClick={addOption} className="mt-2 text-xs font-medium text-hub-accentLight">
            + Add another option
          </button>
        )}

        <p className="mt-5 text-xs font-medium text-hub-textDim">Poll settings</p>
        <div className="mt-2 flex flex-col gap-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-hub-accentLight"
            />
            <span>
              <span className="block text-sm text-white">Allow multiple answers</span>
              <span className="block text-xs text-hub-textDim">People can choose more than one option</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowAddOptions}
              onChange={(e) => setAllowAddOptions(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-hub-accentLight"
            />
            <span>
              <span className="block text-sm text-white">Allow users to add options</span>
              <span className="block text-xs text-hub-textDim">People can add their own options</span>
            </span>
          </label>
        </div>

        <p className="mt-5 text-xs font-medium text-hub-textDim">Poll duration</p>
        <select
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
          className="mt-2 w-full rounded-lg border border-hub-border bg-hub-card px-3 py-2 text-sm text-white outline-none"
        >
          {DURATION_OPTIONS.map((d) => (
            <option key={d.hours} value={d.hours}>
              {d.label}
            </option>
          ))}
        </select>

        {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-hub-border py-2.5 text-sm font-medium text-white"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!canPost}
            className="flex-1 rounded-lg bg-hub-accentLight py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {posting ? "Posting..." : "Post Poll"}
          </button>
        </div>
      </div>
    </main>
  );
}
