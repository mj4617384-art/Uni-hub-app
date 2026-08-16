"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import {
  MoreIcon,
  ShareIcon,
  ThumbsUpIcon,
  CommentIcon,
  BookmarkIcon,
  linkifyContent,
  timeAgo,
} from "@/lib/discover/shared";

type ProfileData = {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  department: string | null;
  faculty: string | null;
  level: string | null;
  campus: string | null;
  university: string | null;
  graduation_year: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  interests: string[] | null;
  show_university_info: boolean | null;
  created_at: string;
};

type UnifiedPost = {
  id: string;
  source: "discover" | "sports";
  text: string | null;
  description: string | null;
  image_urls: string[];
  video_urls: string[];
  created_at: string;
  category?: string;
};

type UnifiedReply = {
  id: string;
  source: "discover" | "sports";
  content: string;
  parentText: string | null;
  created_at: string;
};

const tabs = ["Posts", "Replies", "Media", "Saved"] as const;
type Tab = (typeof tabs)[number];

function joinedLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `Joined ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [postsCount, setPostsCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("Posts");
  const [posts, setPosts] = useState<UnifiedPost[] | null>(null);
  const [replies, setReplies] = useState<UnifiedReply[] | null>(null);
  const [saved, setSaved] = useState<UnifiedPost[] | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);

      const { data: p } = await supabase
        .from("profiles")
        .select(
          "first_name, last_name, username, bio, avatar_url, cover_url, department, faculty, level, campus, university, graduation_year, website_url, instagram_handle, linkedin_url, twitter_handle, interests, show_university_info, created_at"
        )
        .eq("id", data.user.id)
        .single();

      setProfile(p as ProfileData);

      const [discoverCount, sportsCount, bookmarkCount] = await Promise.all([
        supabase.from("discover_posts").select("id", { count: "exact", head: true }).eq("user_id", data.user.id),
        supabase.from("sports_updates").select("id", { count: "exact", head: true }).eq("user_id", data.user.id),
        supabase.from("discover_post_bookmarks").select("id", { count: "exact", head: true }).eq("user_id", data.user.id),
      ]);
      setPostsCount((discoverCount.count ?? 0) + (sportsCount.count ?? 0));
      setSavedCount(bookmarkCount.count ?? 0);

      setLoading(false);
      await loadPosts(data.user.id);
    }
    init();
  }, [router]);

  async function loadPosts(uid: string) {
    setTabLoading(true);
    const [discoverRes, sportsRes] = await Promise.all([
      supabase
        .from("discover_posts")
        .select("id, content, image_url, video_url, image_urls, video_urls, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("sports_updates")
        .select("id, title, description, image_url, image_urls, video_urls, category, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    if (discoverRes.error) console.error(discoverRes.error);
    if (sportsRes.error) console.error(sportsRes.error);

    const discoverMapped: UnifiedPost[] = (discoverRes.data ?? []).map((p: any) => ({
      id: p.id,
      source: "discover",
      text: p.content,
      description: null,
      image_urls: p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [],
      video_urls: p.video_urls?.length ? p.video_urls : p.video_url ? [p.video_url] : [],
      created_at: p.created_at,
    }));
    const sportsMapped: UnifiedPost[] = (sportsRes.data ?? []).map((s: any) => ({
      id: s.id,
      source: "sports",
      text: s.title,
      description: s.description,
      image_urls: s.image_urls?.length ? s.image_urls : s.image_url ? [s.image_url] : [],
      video_urls: s.video_urls ?? [],
      created_at: s.created_at,
      category: s.category,
    }));

    const merged = [...discoverMapped, ...sportsMapped].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setPosts(merged);
    setTabLoading(false);
  }

  async function loadReplies(uid: string) {
    setTabLoading(true);
    const [dc, sc] = await Promise.all([
      supabase
        .from("discover_comments")
        .select("id, content, created_at, discover_posts(content)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("sports_update_comments")
        .select("id, content, created_at, sports_updates(title)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    if (dc.error) console.error(dc.error);
    if (sc.error) console.error(sc.error);

    const dcMapped: UnifiedReply[] = (dc.data ?? []).map((c: any) => ({
      id: c.id,
      source: "discover",
      content: c.content,
      parentText: c.discover_posts?.content ?? null,
      created_at: c.created_at,
    }));
    const scMapped: UnifiedReply[] = (sc.data ?? []).map((c: any) => ({
      id: c.id,
      source: "sports",
      content: c.content,
      parentText: c.sports_updates?.title ?? null,
      created_at: c.created_at,
    }));

    const merged = [...dcMapped, ...scMapped].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setReplies(merged);
    setTabLoading(false);
  }

  async function loadSaved(uid: string) {
    setTabLoading(true);
    const { data, error } = await supabase
      .from("discover_post_bookmarks")
      .select("id, created_at, discover_posts(id, content, image_url, image_urls, video_urls, created_at)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Load saved failed: " + error.message);
      setTabLoading(false);
      return;
    }

    const mapped: UnifiedPost[] = (data ?? [])
      .filter((b: any) => b.discover_posts)
      .map((b: any) => ({
        id: b.discover_posts.id,
        source: "discover" as const,
        text: b.discover_posts.content,
        description: null,
        image_urls: b.discover_posts.image_urls?.length ? b.discover_posts.image_urls : b.discover_posts.image_url ? [b.discover_posts.image_url] : [],
        video_urls: b.discover_posts.video_urls ?? [],
        created_at: b.discover_posts.created_at,
      }));
    setSaved(mapped);
    setTabLoading(false);
  }

  function handleTabClick(tab: Tab) {
    setActiveTab(tab);
    if (!userId) return;
    if (tab === "Replies" && replies === null) loadReplies(userId);
    if (tab === "Saved" && saved === null) loadSaved(userId);
  }

  async function handleAvatarChange(file: File) {
    if (!userId) return;
    setUploadingAvatar(true);
    const path = `${userId}/avatar-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("profile-images").upload(path, file);
    if (upErr) {
      alert("Avatar upload failed: " + upErr.message);
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", userId);
    setUploadingAvatar(false);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, avatar_url: urlData.publicUrl } : prev));
  }

  async function handleCoverChange(file: File) {
    if (!userId) return;
    setUploadingCover(true);
    const path = `${userId}/cover-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("profile-images").upload(path, file);
    if (upErr) {
      alert("Cover upload failed: " + upErr.message);
      setUploadingCover(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ cover_url: urlData.publicUrl }).eq("id", userId);
    setUploadingCover(false);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, cover_url: urlData.publicUrl } : prev));
  }

  async function shareProfile() {
    const url = `${window.location.origin}/profile`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Uni.hub Profile", url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Student";
  const mediaPosts = (posts ?? []).filter((p) => p.image_urls.length > 0 || p.video_urls.length > 0);
  const showUniInfo = profile.show_university_info !== false;
  const hasSocialLinks = profile.website_url || profile.instagram_handle || profile.linkedin_url || profile.twitter_handle;

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      {/* Cover */}
      <div className="relative h-40 w-full overflow-hidden bg-hub-card2">
        {profile.cover_url && <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />}
        <button onClick={() => router.back()} className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
          <BackIcon />
        </button>
        <button
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          <CameraIcon /> {uploadingCover ? "Uploading..." : "Edit Cover"}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleCoverChange(e.target.files[0]);
          }}
        />
      </div>

      {/* Avatar + info */}
      <div className="px-5">
        <div className="relative -mt-10 h-20 w-20">
          <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-hub-bg bg-hub-card2 flex items-center justify-center text-xl font-semibold text-white">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              fullName.charAt(0).toUpperCase()
            )}
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-hub-bg bg-hub-accentLight text-white disabled:opacity-50"
          >
            <CameraIcon small />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleAvatarChange(e.target.files[0]);
            }}
          />
        </div>

        <h1 className="mt-3 text-lg font-semibold text-white">{fullName}</h1>
        {profile.username && <p className="text-sm text-hub-textDim">@{profile.username}</p>}

        {showUniInfo && (profile.department || profile.faculty || profile.level || profile.campus) && (
          <p className="mt-1 text-sm text-hub-textDim">
            {[profile.department, profile.faculty, profile.level, profile.campus].filter(Boolean).join(" · ")}
          </p>
        )}

        <p className="mt-1 flex items-center gap-1 text-xs text-hub-textDim">
          <CalendarSmallIcon /> {joinedLabel(profile.created_at)}
          {showUniInfo && profile.graduation_year ? ` · Class of ${profile.graduation_year}` : ""}
        </p>

        {profile.bio && <p className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{profile.bio}</p>}

        {profile.interests && profile.interests.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.interests.map((tag) => (
              <span key={tag} className="rounded-full border border-hub-accentLight/40 bg-hub-accentLight/10 px-2.5 py-1 text-[11px] text-hub-accentLight">
                {tag}
              </span>
            ))}
          </div>
        )}

        {hasSocialLinks && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-hub-accentLight">
                <LinkIconSmall /> Website
              </a>
            )}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-hub-accentLight"
              >
                <InstagramIconSmall /> {profile.instagram_handle}
              </a>
            )}
            {profile.linkedin_url && (
              <a href={profile.linkedin_url.startsWith("http") ? profile.linkedin_url : `https://${profile.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-hub-accentLight">
                <LinkedinIconSmall /> LinkedIn
              </a>
            )}
            {profile.twitter_handle && (
              <a
                href={`https://x.com/${profile.twitter_handle.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-hub-accentLight"
              >
                <XIconSmall /> {profile.twitter_handle}
              </a>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={() => router.push("/profile/edit")} className="flex-1 rounded-lg border border-hub-border py-2 text-xs font-medium text-white">
            Edit Profile
          </button>
          <button onClick={shareProfile} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-hub-border py-2 text-xs font-medium text-white">
            <ShareIcon /> Share Profile
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-6 border-t border-hub-border pt-3">
          <div>
            <p className="text-sm font-semibold text-white">{postsCount}</p>
            <p className="text-[11px] text-hub-textDim">Posts</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">0</p>
            <p className="text-[11px] text-hub-textDim">Followers</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">0</p>
            <p className="text-[11px] text-hub-textDim">Following</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{savedCount}</p>
            <p className="text-[11px] text-hub-textDim">Saved</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-5 border-b border-hub-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`pb-2 text-sm ${
                activeTab === tab ? "text-hub-accentLight border-b-2 border-hub-accentLight font-medium" : "text-hub-textDim"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-3">
        {tabLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}

        {!tabLoading && activeTab === "Posts" && (
          <>
            {posts && posts.length === 0 && <p className="px-5 text-center text-sm text-hub-textDim">No posts yet.</p>}
            {(posts ?? []).map((p) => (
              <PostRow key={`${p.source}-${p.id}`} post={p} onOpen={() => router.push(p.source === "sports" ? "/discover/sports" : "/discover")} />
            ))}
          </>
        )}

        {!tabLoading && activeTab === "Replies" && (
          <div className="flex flex-col gap-3 px-5">
            {replies && replies.length === 0 && <p className="text-center text-sm text-hub-textDim">No replies yet.</p>}
            {(replies ?? []).map((r) => (
              <div key={`${r.source}-${r.id}`} className="rounded-lg border border-hub-border bg-hub-card p-3">
                {r.parentText && <p className="text-[11px] text-hub-textDim">Replying to: {r.parentText.slice(0, 60)}</p>}
                <p className="mt-1 text-sm text-white/90 whitespace-pre-wrap">{linkifyContent(r.content)}</p>
                <p className="mt-1 text-[10px] text-hub-textDim">{timeAgo(r.created_at)}</p>
              </div>
            ))}
          </div>
        )}

        {!tabLoading && activeTab === "Media" && (
          <div className="grid grid-cols-3 gap-1 px-5">
            {mediaPosts.length === 0 && <p className="col-span-3 text-center text-sm text-hub-textDim">No media yet.</p>}
            {mediaPosts.map((p) => (
              <div key={`${p.source}-${p.id}`} className="aspect-square overflow-hidden bg-hub-card2">
                {p.image_urls[0] ? (
                  <img src={p.image_urls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={p.video_urls[0]} className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        {!tabLoading && activeTab === "Saved" && (
          <>
            {saved && saved.length === 0 && <p className="px-5 text-center text-sm text-hub-textDim">Nothing saved yet.</p>}
            {(saved ?? []).map((p) => (
              <PostRow key={`saved-${p.id}`} post={p} onOpen={() => router.push("/discover")} />
            ))}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function PostRow({ post, onOpen }: { post: UnifiedPost; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full flex-col border-b border-hub-border bg-hub-card px-5 py-3 text-left">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-hub-textDim">
          {timeAgo(post.created_at)} {post.source === "sports" && post.category ? `· ${post.category}` : ""}
        </p>
        <MoreIcon />
      </div>
      {post.text && <p className="mt-1 text-sm text-white/90 line-clamp-3 whitespace-pre-wrap">{linkifyContent(post.text)}</p>}
      {post.description && <p className="mt-1 text-xs text-hub-textDim line-clamp-2">{post.description}</p>}
      {(post.image_urls[0] || post.video_urls[0]) && (
        <div className="mt-2 h-40 w-full overflow-hidden rounded-lg bg-black">
          {post.image_urls[0] ? (
            <img src={post.image_urls[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <video src={post.video_urls[0]} className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-5 text-hub-textDim">
        <ThumbsUpIcon />
        <CommentIcon />
        <ShareIcon />
        <BookmarkIcon filled={false} />
      </div>
    </button>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CameraIcon({ small }: { small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7l1.5-2.5h5L16 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function CalendarSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function LinkIconSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M9 15l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 6l1-1a4 4 0 015.7 5.7l-1 1M13 18l-1 1a4 4 0 01-5.7-5.7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function InstagramIconSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}
function LinkedinIconSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 10v7M7 7v.01M11 17v-4.5a2 2 0 014-.2M15 12.5V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function XIconSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
