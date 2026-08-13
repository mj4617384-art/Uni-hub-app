"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  hashtags: string[];
  created_at: string;
  first_name?: string;
  department?: string | null;
};

const tabs = ["For You", "Following", "Sports", "News", "Clubs"];

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
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

export default function DiscoverPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [activeTab, setActiveTab] = useState("For You");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", data.user.id)
        .single();
      setFirstName(profile?.first_name ?? null);
      await loadPosts();
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadPosts() {
    const { data, error } = await supabase
      .from("discover_posts")
      .select("*, profiles(first_name, department)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      first_name: p.profiles?.first_name ?? "Student",
      department: p.profiles?.department ?? null,
    }));
    setPosts(mapped);
  }

  async function handlePost() {
    if (!userId || (!content.trim() && !imageFile && !videoFile)) return;
    setPosting(true);

    let image_url: string | null = null;
    let video_url: string | null = null;

    if (imageFile) {
      const path = `${userId}/${Date.now()}-${imageFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("discover-images")
        .upload(path, imageFile);
      if (upErr) {
        alert("Image upload failed: " + upErr.message);
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("discover-images")
        .getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    if (videoFile) {
      const path = `${userId}/${Date.now()}-${videoFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("discover-videos")
        .upload(path, videoFile);
      if (upErr) {
        alert("Video upload failed: " + upErr.message);
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("discover-videos")
        .getPublicUrl(path);
      video_url = urlData.publicUrl;
    }

    const hashtags = extractHashtags(content);

    const { error } = await supabase.from("discover_posts").insert({
      user_id: userId,
      content: content.trim() || null,
      image_url,
      video_url,
      hashtags,
    });

    if (error) {
      alert("Post failed: " + error.message);
      setPosting(false);
      return;
    }

    setContent("");
    setImageFile(null);
    setVideoFile(null);
    await loadPosts();
    setPosting(false);
  }

  function toggleLike(id: string) {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleBookmark(id: string) {
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  const visiblePosts = activeTab === "For You" ? posts : [];

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-semibold text-white">Discover</h1>

        {/* Tabs */}
        <div className="mt-4 flex gap-5 overflow-x-auto border-b border-hub-border pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 pb-2 text-sm ${
                activeTab === tab
                  ? "text-hub-accentLight border-b-2 border-hub-accentLight font-medium"
                  : "text-hub-textDim"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Composer — only on For You */}
      {activeTab === "For You" && (
        <div className="mx-5 mt-4 rounded-xl border border-hub-border bg-hub-card p-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
              {firstName ? firstName.charAt(0).toUpperCase() : "U"}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening on campus?"
              rows={2}
              className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
            />
          </div>

          {imageFile && (
            <div className="mt-2 flex items-center gap-2 text-xs text-hub-textDim">
              📷 {imageFile.name}
              <button onClick={() => setImageFile(null)} className="text-red-400">
                Remove
              </button>
            </div>
          )}
          {videoFile && (
            <div className="mt-2 flex items-center gap-2 text-xs text-hub-textDim">
              🎥 {videoFile.name}
              <button onClick={() => setVideoFile(null)} className="text-red-400">
                Remove
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-hub-border pt-3">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-hub-textDim"
              >
                📷 Photo
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setImageFile(e.target.files[0]);
                }}
              />
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-hub-textDim"
              >
                🎥 Video
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setVideoFile(e.target.files[0]);
                }}
              />
            </div>
            <button
              onClick={handlePost}
              disabled={posting || (!content.trim() && !imageFile && !videoFile)}
              className="rounded-lg bg-hub-accentLight px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="mx-5 mt-6 flex flex-col gap-4">
        {activeTab !== "For You" && (
          <p className="text-center text-sm text-hub-textDim">
            {activeTab} isn&apos;t live yet — check back soon.
          </p>
        )}

        {activeTab === "For You" && visiblePosts.length === 0 && (
          <p className="text-center text-sm text-hub-textDim">
            No posts yet — be the first to share something!
          </p>
        )}

        {visiblePosts.map((post) => (
          <div
            key={post.id}
            className="relative rounded-xl border border-hub-border bg-hub-card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                  {post.first_name?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{post.first_name}</p>
                  <p className="text-xs text-hub-textDim">
                    {timeAgo(post.created_at)}
                    {post.department ? ` · ${post.department}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setMenuOpenFor(menuOpenFor === post.id ? null : post.id)
                }
                className="text-hub-textDim px-1"
              >
                ⋯
              </button>
            </div>

            {menuOpenFor === post.id && (
              <div className="absolute right-4 top-12 z-10 w-32 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
                <button className="block w-full px-3 py-2 text-left text-xs text-white/80">
                  Report
                </button>
                {post.user_id === userId && (
                  <button className="block w-full px-3 py-2 text-left text-xs text-red-400">
                    Delete
                  </button>
                )}
              </div>
            )}

            {post.content && (
              <p className="mt-3 text-sm text-white/90 whitespace-pre-wrap">
                {post.content}
              </p>
            )}

            {post.image_url && (
              <img
                src={post.image_url}
                alt="Post image"
                className="mt-3 w-full rounded-lg object-cover"
              />
            )}

            {post.video_url && (
              <video
                src={post.video_url}
                controls
                className="mt-3 w-full rounded-lg"
              />
            )}

            <div className="mt-3 flex items-center justify-between border-t border-hub-border pt-3">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 text-xs ${
                    liked[post.id] ? "text-hub-accentLight" : "text-hub-textDim"
                  }`}
                >
                  {liked[post.id] ? "❤️" : "🤍"} Like
                </button>
                <button className="flex items-center gap-1.5 text-xs text-hub-textDim">
                  💬 Comment
                </button>
              </div>
              <button
                onClick={() => toggleBookmark(post.id)}
                className={`text-sm ${
                  bookmarked[post.id] ? "text-hub-accentLight" : "text-hub-textDim"
                }`}
              >
                {bookmarked[post.id] ? "🔖" : "🏷️"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
