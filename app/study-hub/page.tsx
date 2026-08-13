"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Category = "all" | "notes" | "past_questions" | "books" | "videos";

type Resource = {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  category: string;
  file_url: string | null;
  video_url: string | null;
  created_at: string;
};

const tabs: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "past_questions", label: "Past Questions" },
  { key: "books", label: "Books" },
  { key: "videos", label: "Videos" },
];

export default function StudyHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("study_resources")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("category", activeTab);
      }
      if (search.trim()) {
        query = query.ilike("title", `%${search.trim()}%`);
      }

      const { data } = await query;
      setResources(data ?? []);
      setLoading(false);
    }
    load();
  }, [activeTab, search]);

  const popular = resources.slice(0, 3);
  const recent = resources.slice(3);

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold">Study Hub</h1>
          <p className="text-sm text-hub-textDim">Access notes and resources.</p>
        </div>
      </div>

      <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card2 px-4 py-3">
        <SearchIcon />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes and resources..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-hub-textDim"
        />
        <FilterIcon />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
              activeTab === t.key
                ? "bg-hub-accent text-white"
                : "border border-hub-border text-hub-textDim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
        </div>
      ) : resources.length === 0 ? (
        <p className="mx-5 mt-8 text-sm text-hub-textDim">No resources found yet.</p>
      ) : (
        <>
          {popular.length > 0 && (
            <div className="mx-5 mt-6">
              <h2 className="mb-3 text-sm font-medium text-hub-textDim">Popular Notes</h2>
              <div className="flex flex-col gap-2">
                {popular.map((r) => (
                  <ResourceRow key={r.id} resource={r} />
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="mx-5 mt-6">
              <h2 className="mb-3 text-sm font-medium text-hub-textDim">Recent Resources</h2>
              <div className="flex flex-col gap-2">
                {recent.map((r) => (
                  <ResourceRow key={r.id} resource={r} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={() => router.push("/study-hub/upload")}
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-hub-accent shadow-lg"
        aria-label="Upload resource"
      >
        <PlusIcon />
      </button>

      <BottomNav />
    </main>
  );
}

function ResourceRow({ resource }: { resource: Resource }) {
  const subtitle = [resource.subject, resource.level].filter(Boolean).join(" · ");
  const isVideo = resource.category === "videos";
  const link = isVideo ? resource.video_url : resource.file_url;

  return (
    <a
      href={link ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-card p-3.5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-hub-card2 text-hub-accentLight">
        {isVideo ? <VideoIcon /> : <DocIcon />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{resource.title}</p>
        {subtitle && <p className="truncate text-xs text-hub-textDim">{subtitle}</p>}
      </div>
      {isVideo ? <PlayIcon /> : <DownloadIcon />}
    </a>
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
function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l3 3v15H6V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 3v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 10l4-2v8l-4-2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight shrink-0">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
