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

type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";

const REACTIONS: { type: ReactionType; emoji: string | null; label: string; color: string }[] = [
  { type: "like", emoji: null, label: "Like", color: "text-hub-accentLight" },
  { type: "love", emoji: "❤️", label: "Love", color: "text-red-400" },
  { type: "care", emoji: "🥰", label: "Care", color: "text-yellow-400" },
  { type: "haha", emoji: "😆", label: "Haha", color: "text-yellow-400" },
  { type: "wow", emoji: "😮", label: "Wow", color: "text-yellow-400" },
  { type: "sad", emoji: "😢", label: "Sad", color: "text-yellow-400" },
  { type: "angry", emoji: "😠", label: "Angry", color: "text-orange-500" },
];

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
  const [reactions, setReactions] = useState<Record<string, ReactionType | null>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [interestState, setInterestState] = useState<Record<string, "interested" | "not_interested" | null>>({});
  const [notifyOn, setNotifyOn] = useState<Record<string, boolean>>({});
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      alert("Load posts failed: " + error.message);
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
    setUploadError(null);

    let image_url: string | null = null;
    let video_url: string | null = null;

    if (imageFile) {
      const path = `${userId}/${Date.now()}-${imageFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("discover-images")
        .upload(path, imageFile);
      if (upErr) {
        setUploadError("Image upload failed: " + upErr.message);
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
        setUploadError("Video upload failed: " + upErr.message);
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
      setUploadError("Post failed: " + error.message);
      setPosting(false);
      return;
    }

    setContent("");
    setImageFile(null);
    setVideoFile(null);
    await loadPosts();
    setPosting(false);
  }

  async function handleDeletePost(postId: string) {
    if (!userId) return;
    const confirmed = window.confirm("Delete this post? This can't be undone.");
    if (!confirmed) return;

    setDeletingId(postId);
    const { error } = await supabase
      .from("discover_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", userId);

    setDeletingId(null);
    setMenuOpenFor(null);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  function pickReaction(postId: string, type: ReactionType) {
    setReactions((prev) => ({
      ...prev,
      [postId]: prev[postId] === type ? null : type,
    }));
    setReactionPickerFor(null);
  }

  function toggleReactionButton(postId: string) {
    if (reactionPickerFor === postId) {
      setReactionPickerFor(null);
      return;
    }
    setReactionPickerFor(postId);
  }

  function toggleBookmark(id: string) {
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function sharePost(post: Post) {
    const url = `${window.location.origin}/discover?post=${post.id}`;
    const text = post.content?.slice(0, 100) || "Check out this post on Uni.hub";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Uni.hub", text, url });
      } catch {
        // user cancelled share sheet, no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
    setMenuOpenFor(null);
  }

  async function copyLink(post: Post) {
    const url = `${window.location.origin}/discover?post=${post.id}`;
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard");
    setMenuOpenFor(null);
  }

  function setInterest(postId: string, val: "interested" | "not_interested") {
    setInterestState((prev) => ({
      ...prev,
      [postId]: prev[postId] === val ? null : val,
    }));
    setMenuOpenFor(null);
  }

  function toggleNotify(postId: string) {
    setNotifyOn((prev) => ({ ...prev, [postId]: !prev[postId] }));
    setMenuOpenFor(null);
  }

  function hidePost(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setMenuOpenFor(null);
  }

  function reportPost() {
    alert("Post reported. Our team will review it.");
    setMenuOpenFor(null);
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
              <PhotoIcon />
              <span>{imageFile.name}</span>
              <button onClick={() => setImageFile(null)} className="text-red-400 shrink-0">
                Remove
              </button>
            </div>
          )}
          {videoFile && (
            <div className="mt-2 flex items-center gap-2 text-xs text-hub-textDim">
              <VideoIcon />
              <span>{videoFile.name}</span>
              <button onClick={() => setVideoFile(null)} className="text-red-400 shrink-0">
                Remove
              </button>
            </div>
          )}

          {uploadError && (
            <p className="mt-2 text-xs text-red-400">{uploadError}</p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-hub-border pt-3">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim"
              >
                <PhotoIcon />
                <span>Photo</span>
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
                className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim"
              >
                <VideoIcon />
                <span>Video</span>
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
              className="shrink-0 rounded-lg bg-hub-accentLight px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      )}

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

        {visiblePosts.map((post) => {
          const activeReaction = reactions[post.id];
          const activeReactionInfo = REACTIONS.find((r) => r.type === activeReaction);
          const isMine = post.user_id === userId;

          return (
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
                  className="shrink-0 text-hub-textDim px-1"
                >
                  <MoreIcon />
                </button>
              </div>

              {menuOpenFor === post.id && (
                <div className="absolute right-4 top-12 z-20 w-56 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
                  <button
                    onClick={() => setInterest(post.id, "interested")}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left"
                  >
                    <PlusCircleIcon />
                    <span>
                      <span className="block text-xs font-medium text-white">
                        {interestState[post.id] === "interested" ? "Marked Interested" : "Interested"}
                      </span>
                      <span className="block text-[10px] text-hub-textDim">More posts like this</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setInterest(post.id, "not_interested")}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left"
                  >
                    <MinusCircleIcon />
                    <span>
                      <span className="block text-xs font-medium text-white">
                        {interestState[post.id] === "not_interested" ? "Marked Not interested" : "Not interested"}
                      </span>
                      <span className="block text-[10px] text-hub-textDim">Fewer posts like this</span>
                    </span>
                  </button>
                  <div className="my-1 border-t border-hub-border" />
                  <button
                    onClick={() => toggleBookmark(post.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"
                  >
                    <BookmarkIcon filled={!!bookmarked[post.id]} />
                    {bookmarked[post.id] ? "Saved" : "Save post"}
                  </button>
                  <button
                    onClick={() => sharePost(post)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"
                  >
                    <ShareIcon />
                    Share
                  </button>
                  <button
                    onClick={() => hidePost(post.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"
                  >
                    <EyeOffIcon />
                    I don&apos;t want to see this
                  </button>
                  <button
                    onClick={reportPost}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"
                  >
                    <FlagIcon />
                    Report post
                  </button>
                  <button
                    onClick={() => toggleNotify(post.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"
                  >
                    <BellSmallIcon />
                    {notifyOn[post.id] ? "Turn off notifications" : "Turn on notifications"}
                  </button>
                  <button
                    onClick={() => copyLink(post)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"
                  >
                    <LinkIcon />
                    Copy link
                  </button>
                  {isMine && (
                    <>
                      <div className="my-1 border-t border-hub-border" />
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingId === post.id}
                        className="block w-full px-3 py-2 text-left text-xs text-red-400 disabled:opacity-40"
                      >
                        {deletingId === post.id ? "Deleting..." : "Delete post"}
                      </button>
                    </>
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
                  loading="lazy"
                  className="mt-3 w-full rounded-lg object-cover"
                />
              )}

              {post.video_url && (
                <video
                  src={post.video_url}
                  controls
                  preload="metadata"
                  className="mt-3 w-full rounded-lg"
                />
              )}

              <div className="relative mt-3 flex items-center justify-between border-t border-hub-border pt-3">
                {reactionPickerFor === post.id && (
                  <div className="absolute bottom-full left-0 z-20 mb-2 flex items-center gap-1 rounded-full border border-hub-border bg-hub-card2 px-2 py-1.5 shadow-lg">
                    {REACTIONS.map((r) => (
                      <button
                        key={r.type}
                        onClick={() => pickReaction(post.id, r.type)}
                        className={`flex items-center justify-center leading-none transition-transform active:scale-125 ${
                          activeReaction === r.type ? "scale-110" : ""
                        }`}
                        aria-label={r.label}
                      >
                        {r.type === "like" ? (
                          <ThumbsUpIcon className="text-hub-accentLight" />
                        ) : (
                          <span className="text-lg">{r.emoji}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-5">
                  <button
                    onClick={() => toggleReactionButton(post.id)}
                    className={`flex shrink-0 items-center gap-1.5 text-xs ${
                      activeReactionInfo ? activeReactionInfo.color : "text-hub-textDim"
                    }`}
                  >
                    {activeReactionInfo ? (
                      activeReactionInfo.type === "like" ? (
                        <ThumbsUpIcon className="text-hub-accentLight" filled />
                      ) : (
                        <span className="text-sm leading-none">{activeReactionInfo.emoji}</span>
                      )
                    ) : (
                      <HeartIcon filled={false} />
                    )}
                    <span>{activeReactionInfo ? activeReactionInfo.label : "Like"}</span>
                  </button>
                  <button className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim">
                    <CommentIcon />
                    <span>Comment</span>
                  </button>
                  <button
                    onClick={() => sharePost(post)}
                    className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim"
                  >
                    <ShareIcon />
                    <span>Share</span>
                  </button>
                </div>
                <button
                  onClick={() => toggleBookmark(post.id)}
                  className={`shrink-0 ${
                    bookmarked[post.id] ? "text-hub-accentLight" : "text-hub-textDim"
                  }`}
                >
                  <BookmarkIcon filled={!!bookmarked[post.id]} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </main>
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
function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path
        d="M12 20s-7-4.35-9.5-8.5C.7 8 2.5 4.5 6 4.5c2 0 3.5 1.2 6 3.5 2.5-2.3 4-3.5 6-3.5 3.5 0 5.3 3.5 3.5 7C19 15.65 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ThumbsUpIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      className={className}
    >
      <path
        d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm0 0l4.5-8a2 2 0 013.7 1.6L14 9h5a2 2 0 012 2.2l-1.3 7A2 2 0 0117.7 20H10a3 3 0 01-3-3v-6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h16v12H8l-4 4V4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path d="M6 3h12v18l-6-4-6 4V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10.6 5.1A10.9 10.9 0 0112 5c5 0 9 4 10 7-.5 1.2-1.5 2.8-3 4.1M6.5 6.6C4.2 8 2.6 10.1 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 3.9-.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M9.5 12a2.5 2.5 0 003.6 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function BellSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 15l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 6l1-1a4 4 0 015.7 5.7l-1 1M13 18l-1 1a4 4 0 01-5.7-5.7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PlusCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function MinusCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
