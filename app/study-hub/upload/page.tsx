"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Category = "notes" | "past_questions" | "books" | "videos";

const categories: { key: Category; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "past_questions", label: "Past Questions" },
  { key: "books", label: "Books" },
  { key: "videos", label: "Videos" },
];

export default function UploadResourcePage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("notes");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = category === "videos";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/auth");
      return;
    }

    let file_url: string | null = null;

    if (!isVideo) {
      if (!file) {
        setError("Please select a file to upload.");
        setLoading(false);
        return;
      }
      const filePath = `${userData.user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("study-resources")
        .upload(filePath, file);

      if (uploadError) {
        setError(uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("study-resources")
        .getPublicUrl(filePath);
      file_url = publicUrlData.publicUrl;
    } else {
      if (!videoUrl.trim()) {
        setError("Please add a video link.");
        setLoading(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from("study_resources").insert({
      uploader_id: userData.user.id,
      title,
      subject: subject || null,
      level: level || null,
      category,
      file_url,
      video_url: isVideo ? videoUrl : null,
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push("/study-hub");
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pt-5 pb-10">
      <button onClick={() => router.back()} aria-label="Back" className="mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <h1 className="text-xl font-semibold">Upload Resource</h1>
      <p className="mt-1 text-sm text-hub-textDim">Share notes, past questions, books, or videos with your campus.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              category === c.key
                ? "bg-hub-accent text-white"
                : "border border-hub-border text-hub-textDim"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Data Structures Notes"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Subject (optional)</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Computer Science"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Level (optional)</span>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="e.g. 2nd Year"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        {isVideo ? (
          <label className="text-sm">
            <span className="mb-1.5 block text-hub-textDim">Video Link</span>
            <input
              required
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
            />
          </label>
        ) : (
          <label className="text-sm">
            <span className="mb-1.5 block text-hub-textDim">File (PDF, DOC, etc.)</span>
            <input
              required
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-hub-accent file:px-3 file:py-1.5 file:text-white"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </main>
  );
}
