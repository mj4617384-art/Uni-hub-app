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
  PhotoIcon,
  VideoIcon,
  MediaCarousel,
  MAX_MEDIA_PER_TYPE,
  extractHashtags,
  detectCategory,
  linkifyContent,
  timeAgo,
  REACTIONS,
  REACTION_TOP,
  REACTION_BOTTOM,
  ReactionType,
  ReactionRecord,
  Comment,
  CommentRow,
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

type Source = "discover" | "sports";

type UnifiedPost = {
  id: string;
  source: Source;
  user_id: string;
  text: string | null;
  description: string | null;
  image_urls: string[];
  video_urls: string[];
  created_at: string;
  category?: string;
};

type UnifiedReply = {
  id: string;
  source: Source;
  content: string;
  parentText: string | null;
  created_at: string;
};

type MediaEditTarget = { type: "image" | "video"; index: number };

const tabs = ["Posts", "Replies", "Media", "Saved"] as const;
type Tab = (typeof tabs)[number];

function joinedLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `Joined ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

function keyFor(source: Source, id: string) {
  return `${source}-${id}`;
}

function tables(source: Source) {
  return source === "discover"
    ? {
        reactions: "discover_reactions",
        comments: "discover_comments",
        commentLikes: "discover_comment_likes",
        posts: "discover_posts",
        idField: "post_id",
      }
    : {
        reactions: "sports_update_reactions",
        comments: "sports_update_comments",
        commentLikes: "sports_update_comment_likes",
        posts: "sports_updates",
        idField: "sports_update_id",
      };
}

function useFilePreviewUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => {
      next.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);
  return urls;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("Posts");
  const [posts, setPosts] = useState<UnifiedPost[] | null>(null);
  const [replies, setReplies] = useState<UnifiedReply[] | null>(null);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [saved, setSaved] = useState<UnifiedPost[] | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  const [reactionsByKey, setReactionsByKey] = useState<Record<string, ReactionRecord[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [commentsByKey, setCommentsByKey] = useState<Record<string, Comment[]>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentOpenFor, setCommentOpenFor] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Record<string, { commentId: string; name: string } | null>>({});
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const reactionScopeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuScopeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const videoObserverRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    videoObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) video.pause();
        });
      },
      { threshold: [0, 0.5, 1] }
    );
    return () => videoObserverRef.current?.disconnect();
  }, []);
  function registerVideoRef(el: HTMLVideoElement | null) {
    if (el) videoObserverRef.current?.observe(el);
  }

  const [composerExpanded, setComposerExpanded] = useState(false);
  const [composerContent, setComposerContent] = useState("");
  const [composerImages, setComposerImages] = useState<File[]>([]);
  const [composerVideos, setComposerVideos] = useState<File[]>([]);
  const [composerVisibility, setComposerVisibility] = useState<"public" | "campus">("public");
  const [composerPosting, setComposerPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [pendingMediaTrigger, setPendingMediaTrigger] = useState<"image" | "video" | null>(null);
  const [mediaEditTarget, setMediaEditTarget] = useState<MediaEditTarget | null>(null);
  const [rotating, setRotating] = useState(false);
  const composerImageInputRef = useRef<HTMLInputElement>(null);
  const composerVideoInputRef = useRef<HTMLInputElement>(null);
  const composerTextRef = useRef<HTMLTextAreaElement>(null);

  const composerImagePreviews = useFilePreviewUrls(composerImages);
  const composerVideoPreviews = useFilePreviewUrls(composerVideos);

  useEffect(() => {
    if (composerExpanded && pendingMediaTrigger) {
      if (pendingMediaTrigger === "image") composerImageInputRef.current?.click();
      if (pendingMediaTrigger === "video") composerVideoInputRef.current?.click();
      setPendingMediaTrigger(null);
    }
  }, [composerExpanded, pendingMediaTrigger]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (reactionPickerFor) {
        const scope = reactionScopeRefs.current[reactionPickerFor];
        if (scope && !scope.contains(e.target as Node)) setReactionPickerFor(null);
      }
      if (menuOpenFor) {
        const scope = menuScopeRefs.current[menuOpenFor];
        if (scope && !scope.contains(e.target as Node)) setMenuOpenFor(null);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [reactionPickerFor, menuOpenFor]);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);

      const { data: p, error: profileError } = await supabase
        .from("profiles")
        .select(
          "first_name, last_name, username, bio, avatar_url, cover_url, department, faculty, level, campus, university, graduation_year, website_url, instagram_handle, linkedin_url, twitter_handle, interests, show_university_info, created_at"
        )
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setLoadError(profileError.message);
        setLoading(false);
        return;
      }

      setProfile(p as ProfileData);

      const [bookmarkRows, bookmarkCount] = await Promise.all([
        supabase.from("discover_post_bookmarks").select("post_id").eq("user_id", data.user.id),
        supabase.from("discover_post_bookmarks").select("id", { count: "exact", head: true }).eq("user_id", data.user.id),
      ]);
      if (bookmarkRows.data) setBookmarkedIds(new Set(bookmarkRows.data.map((b: any) => b.post_id)));
      setSavedCount(bookmarkCount.count ?? 0);

      setLoading(false);
      await loadPosts(data.user.id);
    }
    init();
  }, [router]);

  async function loadEngagementFor(items: UnifiedPost[]) {
    const discoverIds = items.filter((p) => p.source === "discover").map((p) => p.id);
    const sportsIds = items.filter((p) => p.source === "sports").map((p) => p.id);

    const [dr, dc, sr, sc] = await Promise.all([
      discoverIds.length
        ? supabase.from("discover_reactions").select("post_id, user_id, type, profiles(first_name)").in("post_id", discoverIds)
        : Promise.resolve({ data: [] as any[] }),
      discoverIds.length
        ? supabase.from("discover_comments").select("*, profiles(first_name)").in("post_id", discoverIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      sportsIds.length
        ? supabase.from("sports_update_reactions").select("sports_update_id, user_id, type, profiles(first_name)").in("sports_update_id", sportsIds)
        : Promise.resolve({ data: [] as any[] }),
      sportsIds.length
        ? supabase.from("sports_update_comments").select("*, profiles(first_name)").in("sports_update_id", sportsIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const reactionMap: Record<string, ReactionRecord[]> = {};
    (dr.data ?? []).forEach((r: any) => {
      const k = keyFor("discover", r.post_id);
      if (!reactionMap[k]) reactionMap[k] = [];
      reactionMap[k].push({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" });
    });
    (sr.data ?? []).forEach((r: any) => {
      const k = keyFor("sports", r.sports_update_id);
      if (!reactionMap[k]) reactionMap[k] = [];
      reactionMap[k].push({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" });
    });
    setReactionsByKey((prev) => ({ ...prev, ...reactionMap }));

    const commentMap: Record<string, Comment[]> = {};
    const allCommentIds: string[] = [];
    (dc.data ?? []).forEach((c: any) => {
      const k = keyFor("discover", c.post_id);
      if (!commentMap[k]) commentMap[k] = [];
      commentMap[k].push({ ...c, first_name: c.profiles?.first_name ?? "Student" });
      allCommentIds.push(c.id);
    });
    (sc.data ?? []).forEach((c: any) => {
      const k = keyFor("sports", c.sports_update_id);
      if (!commentMap[k]) commentMap[k] = [];
      commentMap[k].push({ ...c, first_name: c.profiles?.first_name ?? "Student" });
      allCommentIds.push(c.id);
    });
    setCommentsByKey((prev) => ({ ...prev, ...commentMap }));

    if (allCommentIds.length > 0) {
      const [dcl, scl] = await Promise.all([
        supabase.from("discover_comment_likes").select("comment_id, user_id").in("comment_id", allCommentIds),
        supabase.from("sports_update_comment_likes").select("comment_id, user_id").in("comment_id", allCommentIds),
      ]);
      setCommentLikes((prev) => {
        const next = { ...prev };
        allCommentIds.forEach((id) => {
          if (!next[id]) next[id] = { count: 0, mine: false };
        });
        [...(dcl.data ?? []), ...(scl.data ?? [])].forEach((row: any) => {
          if (!next[row.comment_id]) next[row.comment_id] = { count: 0, mine: false };
          next[row.comment_id].count += 1;
          if (row.user_id === userId) next[row.comment_id].mine = true;
        });
        return next;
      });
    }
  }

  async function refreshReactionsFor(post: UnifiedPost) {
    const t = tables(post.source);
    const { data, error } = await supabase
      .from(t.reactions)
      .select(`${t.idField}, user_id, type, profiles(first_name)`)
      .eq(t.idField, post.id);
    if (error) {
      console.error(error);
      return;
    }
    setReactionsByKey((prev) => ({
      ...prev,
      [keyFor(post.source, post.id)]: (data ?? []).map((r: any) => ({
        type: r.type,
        user_id: r.user_id,
        first_name: r.profiles?.first_name ?? "Student",
      })),
    }));
  }

  async function refreshCommentsFor(post: UnifiedPost) {
    const t = tables(post.source);
    const { data, error } = await supabase
      .from(t.comments)
      .select("*, profiles(first_name)")
      .eq(t.idField, post.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const mapped = (data ?? []).map((c: any) => ({ ...c, first_name: c.profiles?.first_name ?? "Student" }));
    setCommentsByKey((prev) => ({ ...prev, [keyFor(post.source, post.id)]: mapped }));
    const ids = mapped.map((c: any) => c.id);
    if (ids.length > 0) {
      const { data: likeData } = await supabase.from(t.commentLikes).select("comment_id, user_id").in("comment_id", ids);
      setCommentLikes((prev) => {
        const next = { ...prev };
        ids.forEach((id: string) => {
          next[id] = { count: 0, mine: false };
        });
        (likeData ?? []).forEach((row: any) => {
          if (!next[row.comment_id]) next[row.comment_id] = { count: 0, mine: false };
          next[row.comment_id].count += 1;
          if (row.user_id === userId) next[row.comment_id].mine = true;
        });
        return next;
      });
    }
  }

  async function loadPosts(uid: string) {
    setTabLoading(true);
    const [discoverRes, sportsRes] = await Promise.all([
      supabase
        .from("discover_posts")
        .select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("sports_updates")
        .select("id, user_id, title, description, image_url, image_urls, video_urls, category, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    if (discoverRes.error) {
      console.error(discoverRes.error);
      alert("Load posts failed: " + discoverRes.error.message);
    }
    if (sportsRes.error) {
      console.error(sportsRes.error);
      alert("Load sports posts failed: " + sportsRes.error.message);
    }

    const discoverMapped: UnifiedPost[] = (discoverRes.data ?? []).map((p: any) => ({
      id: p.id,
      source: "discover",
      user_id: p.user_id,
      text: p.content,
      description: null,
      image_urls: p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [],
      video_urls: p.video_urls?.length ? p.video_urls : p.video_url ? [p.video_url] : [],
      created_at: p.created_at,
    }));
    const sportsMapped: UnifiedPost[] = (sportsRes.data ?? []).map((s: any) => ({
      id: s.id,
      source: "sports",
      user_id: s.user_id,
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
    await loadEngagementFor(merged);
  }

  async function loadReplies(uid: string) {
    setTabLoading(true);
    setRepliesError(null);
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

    if (dc.error || sc.error) {
      const msg = dc.error?.message || sc.error?.message || "unknown error";
      console.error(dc.error, sc.error);
      setRepliesError(msg);
      setTabLoading(false);
      return;
    }

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
      .select("id, created_at, discover_posts(id, user_id, content, image_url, image_urls, video_urls, created_at)")
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
        user_id: b.discover_posts.user_id,
        text: b.discover_posts.content,
        description: null,
        image_urls: b.discover_posts.image_urls?.length ? b.discover_posts.image_urls : b.discover_posts.image_url ? [b.discover_posts.image_url] : [],
        video_urls: b.discover_posts.video_urls ?? [],
        created_at: b.discover_posts.created_at,
      }));
    setSaved(mapped);
    setTabLoading(false);
    await loadEngagementFor(mapped);
  }

  function handleTabClick(tab: Tab) {
    setActiveTab(tab);
    if (!userId) return;
    if (tab === "Replies" && replies === null) loadReplies(userId);
    if (tab === "Saved" && saved === null) loadSaved(userId);
  }

  async function pickReaction(post: UnifiedPost, type: ReactionType) {
    if (!userId) return;
    const k = keyFor(post.source, post.id);
    setReactingKey(k);
    const t = tables(post.source);
    const existing = (reactionsByKey[k] || []).find((r) => r.user_id === userId);
    if (existing && existing.type === type) {
      await supabase.from(t.reactions).delete().eq(t.idField, post.id).eq("user_id", userId);
    } else {
      await supabase.from(t.reactions).upsert({ [t.idField]: post.id, user_id: userId, type }, { onConflict: `${t.idField},user_id` });
    }
    await refreshReactionsFor(post);
    setReactingKey(null);
    setReactionPickerFor(null);
  }

  function startReply(post: UnifiedPost, commentId: string, name: string) {
    const k = keyFor(post.source, post.id);
    setReplyTo((prev) => ({ ...prev, [k]: { commentId, name } }));
    setCommentOpenFor(k);
    setTimeout(() => commentInputRefs.current[k]?.focus(), 0);
  }
  function cancelReply(k: string) {
    setReplyTo((prev) => ({ ...prev, [k]: null }));
  }

  async function toggleCommentLike(post: UnifiedPost, commentId: string) {
    if (!userId) return;
    const t = tables(post.source);
    const current = commentLikes[commentId] || { count: 0, mine: false };
    if (current.mine) {
      setCommentLikes((prev) => ({ ...prev, [commentId]: { count: Math.max(0, current.count - 1), mine: false } }));
      const { error } = await supabase.from(t.commentLikes).delete().eq("comment_id", commentId).eq("user_id", userId);
      if (error) setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
    } else {
      setCommentLikes((prev) => ({ ...prev, [commentId]: { count: current.count + 1, mine: true } }));
      const { error } = await supabase.from(t.commentLikes).insert({ comment_id: commentId, user_id: userId });
      if (error) setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
    }
  }

  async function submitComment(post: UnifiedPost) {
    if (!userId) return;
    const k = keyFor(post.source, post.id);
    const text = (commentDraft[k] || "").trim();
    if (!text) return;
    setCommentPosting(k);
    const t = tables(post.source);
    const parentId = replyTo[k]?.commentId ?? null;
    const { error } = await supabase.from(t.comments).insert({ [t.idField]: post.id, user_id: userId, parent_id: parentId, content: text });
    setCommentPosting(null);
    if (error) {
      alert("Comment failed: " + error.message);
      return;
    }
    setCommentDraft((prev) => ({ ...prev, [k]: "" }));
    setReplyTo((prev) => ({ ...prev, [k]: null }));
    await refreshCommentsFor(post);
  }

  async function toggleBookmark(post: UnifiedPost) {
    if (!userId || post.source !== "discover") return;
    const isSaved = bookmarkedIds.has(post.id);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    if (isSaved) {
      await supabase.from("discover_post_bookmarks").delete().eq("post_id", post.id).eq("user_id", userId);
      setSaved((prev) => (prev ? prev.filter((p) => p.id !== post.id) : prev));
      setSavedCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("discover_post_bookmarks").insert({ post_id: post.id, user_id: userId });
      setSavedCount((c) => c + 1);
    }
  }

  async function sharePost(post: UnifiedPost) {
    const url =
      post.source === "sports"
        ? `${window.location.origin}/discover/sports?update=${post.id}`
        : `${window.location.origin}/discover?post=${post.id}`;
    const text = post.text?.slice(0, 100) || "Check out this post on Uni.hub";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Uni.hub", text, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
    setMenuOpenFor(null);
  }

  async function copyLink(post: UnifiedPost) {
    const url =
      post.source === "sports"
        ? `${window.location.origin}/discover/sports?update=${post.id}`
        : `${window.location.origin}/discover?post=${post.id}`;
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard");
    setMenuOpenFor(null);
  }

  async function handleDeletePost(post: UnifiedPost) {
    if (!userId) return;
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    const k = keyFor(post.source, post.id);
    setDeletingKey(k);
    const t = tables(post.source);
    const { error } = await supabase.from(t.posts).delete().eq("id", post.id).eq("user_id", userId);
    setDeletingKey(null);
    setMenuOpenFor(null);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    setPosts((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
    setSaved((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
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

  function openComposer() {
    setComposerExpanded(true);
    setTimeout(() => composerTextRef.current?.focus(), 0);
  }
  function closeComposerIfEmpty() {
    if (!composerContent.trim() && composerImages.length === 0 && composerVideos.length === 0) {
      setComposerExpanded(false);
    }
  }
  function addComposerImages(files: File[]) {
    setComposerImages((prev) => [...prev, ...files].slice(0, MAX_MEDIA_PER_TYPE));
  }
  function addComposerVideos(files: File[]) {
    setComposerVideos((prev) => [...prev, ...files].slice(0, MAX_MEDIA_PER_TYPE));
  }
  function removeComposerImage(i: number) {
    setComposerImages((prev) => prev.filter((_, idx) => idx !== i));
  }
  function removeComposerVideo(i: number) {
    setComposerVideos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function rotateComposerImage(index: number) {
    const file = composerImages[index];
    if (!file) return;
    setRotating(true);
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), file.type || "image/jpeg", 0.92));
      if (!blob) return;
      const rotatedFile = new File([blob], file.name, { type: file.type || "image/jpeg" });
      setComposerImages((prev) => prev.map((f, i) => (i === index ? rotatedFile : f)));
    } finally {
      setRotating(false);
    }
  }

  async function handleComposerPost() {
    if (!userId || (!composerContent.trim() && composerImages.length === 0 && composerVideos.length === 0)) return;
    setComposerPosting(true);
    setComposerError(null);

    const image_urls: string[] = [];
    const video_urls: string[] = [];

    for (const file of composerImages) {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("discover-images").upload(path, file);
      if (upErr) {
        setComposerError("Image upload failed: " + upErr.message);
        setComposerPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("discover-images").getPublicUrl(path);
      image_urls.push(urlData.publicUrl);
    }
    for (const file of composerVideos) {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("discover-videos").upload(path, file);
      if (upErr) {
        setComposerError("Video upload failed: " + upErr.message);
        setComposerPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("discover-videos").getPublicUrl(path);
      video_urls.push(urlData.publicUrl);
    }

    const hashtags = extractHashtags(composerContent);
    const category = detectCategory(composerContent, hashtags) || "Campus Life";

    const { data: inserted, error } = await supabase
      .from("discover_posts")
      .insert({
        user_id: userId,
        content: composerContent.trim() || null,
        image_url: image_urls[0] ?? null,
        video_url: video_urls[0] ?? null,
        image_urls,
        video_urls,
        hashtags,
        category,
        visibility: composerVisibility,
        campus: profile?.campus ?? null,
      })
      .select("id, category, visibility, created_at")
      .single();

    if (error) {
      setComposerError("Post failed: " + error.message);
      setComposerPosting(false);
      return;
    }

    if (inserted) {
      const { error: feedErr } = await supabase.from("discover_feed_items").insert({
        source_type: "discover_post",
        source_id: inserted.id,
        user_id: userId,
        category: inserted.category ?? "Campus Life",
        visibility: inserted.visibility ?? "public",
        created_at: inserted.created_at,
      });
      if (feedErr) console.error("Feed index insert failed:", feedErr);
    }

    setComposerContent("");
    setComposerImages([]);
    setComposerVideos([]);
    setComposerVisibility("public");
    setComposerPosting(false);
    setComposerExpanded(false);
    if (userId) await loadPosts(userId);
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-hub-bg px-6 text-center">
        <p className="text-sm text-red-400">Couldn&apos;t load your profile: {loadError}</p>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-hub-accentLight px-4 py-2 text-xs font-medium text-white">
          Retry
        </button>
      </div>
    );
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
  const postsCount = posts?.length ?? 0;

  function renderPostCard(post: UnifiedPost) {
    const k = keyFor(post.source, post.id);
    const postReactions = reactionsByKey[k] || [];
    const myReaction = postReactions.find((r) => r.user_id === userId)?.type ?? null;
    const activeReactionInfo = REACTIONS.find((r) => r.type === myReaction);
    const allComments = commentsByKey[k] || [];
    const topLevel = allComments.filter((c) => !c.parent_id);
    const repliesOf = (id: string) => allComments.filter((c) => c.parent_id === id);
    const currentReply = replyTo[k];
    const isMine = post.user_id === userId;
    const isSaved = post.source === "discover" && bookmarkedIds.has(post.id);

    // top distinct reaction types present, most frequent first, capped at 3 — for the compact icon cluster
    const typeCounts: Record<string, number> = {};
    postReactions.forEach((r) => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    });
    const topTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => REACTIONS.find((r) => r.type === type))
      .filter(Boolean) as typeof REACTIONS;

    return (
      <div key={k} className="relative border-b border-hub-border bg-hub-card px-4 py-3">
        <div ref={(el) => { menuScopeRefs.current[k] = el; }} className="relative">
          <div className="flex items-start justify-between">
            <p className="text-[11px] text-hub-textDim">
              {timeAgo(post.created_at)}
              {post.source === "sports" && post.category ? ` · ${post.category}` : ""}
            </p>
            <button onClick={() => setMenuOpenFor(menuOpenFor === k ? null : k)} className="shrink-0 text-hub-textDim px-1">
              <MoreIcon />
            </button>
          </div>

          {menuOpenFor === k && (
            <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
              <button onClick={() => sharePost(post)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                <ShareIcon />Share
              </button>
              <button onClick={() => copyLink(post)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                Copy link
              </button>
              {isMine && (
                <>
                  <div className="my-1 border-t border-hub-border" />
                  <button
                    onClick={() => handleDeletePost(post)}
                    disabled={deletingKey === k}
                    className="block w-full px-3 py-2 text-left text-xs text-red-400 disabled:opacity-40"
                  >
                    {deletingKey === k ? "Deleting..." : "Delete post"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {post.text && <p className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{linkifyContent(post.text)}</p>}
        {post.description && <p className="mt-1 text-xs text-hub-textDim whitespace-pre-wrap">{linkifyContent(post.description)}</p>}

        <MediaCarousel images={post.image_urls} videos={post.video_urls} registerVideoRef={registerVideoRef} />

        {/* Compact fitting row — reaction cluster+count, comment+count, share, bookmark, evenly spread */}
        <div ref={(el) => { reactionScopeRefs.current[k] = el; }} className="relative mt-3 flex items-center justify-between border-t border-hub-border pt-3">
          {reactionPickerFor === k && (
            <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-hub-border bg-hub-card2 px-4 py-3 shadow-xl">
              <div className="flex items-start gap-4">
                {REACTION_TOP.map((r) => (
                  <button key={r.type} onClick={() => pickReaction(post, r.type)} disabled={reactingKey === k} className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                      {r.type === "like" ? <ThumbsUpIcon className="text-white" filled /> : <span className="text-lg leading-none">{r.emoji}</span>}
                    </span>
                    <span className="text-[10px] text-hub-textDim">{r.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-4">
                {REACTION_BOTTOM.map((r) => (
                  <button key={r.type} onClick={() => pickReaction(post, r.type)} disabled={reactingKey === k} className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                      <span className="text-lg leading-none">{r.emoji}</span>
                    </span>
                    <span className="text-[10px] text-hub-textDim">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setReactionPickerFor((prev) => (prev === k ? null : k))}
            className={`flex items-center gap-1.5 text-xs ${activeReactionInfo ? "text-hub-accentLight" : "text-hub-textDim"}`}
          >
            {topTypes.length > 0 ? (
              <span className="flex items-center">
                {topTypes.map((r, i) => (
                  <span
                    key={r.type}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border border-hub-card ${r.bg} ${i > 0 ? "-ml-1.5" : ""}`}
                  >
                    {r.type === "like" ? (
                      <ThumbsUpIcon className="text-white" filled small />
                    ) : (
                      <span className="text-[10px] leading-none">{r.emoji}</span>
                    )}
                  </span>
                ))}
              </span>
            ) : (
              <ThumbsUpIcon className="text-hub-textDim" />
            )}
            {postReactions.length > 0 && <span>{postReactions.length}</span>}
          </button>

          <button onClick={() => setCommentOpenFor(commentOpenFor === k ? null : k)} className="flex items-center gap-1.5 text-xs text-hub-textDim">
            <CommentIcon />
            {allComments.length > 0 && <span>{allComments.length}</span>}
          </button>

          <button onClick={() => sharePost(post)} className="flex items-center gap-1.5 text-xs text-hub-textDim">
            <ShareIcon />
          </button>

          {post.source === "discover" && (
            <button onClick={() => toggleBookmark(post)} className={`shrink-0 ${isSaved ? "text-hub-accentLight" : "text-hub-textDim"}`}>
              <BookmarkIcon filled={isSaved} />
            </button>
          )}
        </div>

        {commentOpenFor === k && (
          <div className="mt-3 border-t border-hub-border pt-3">
            <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
              {topLevel.length === 0 && <p className="text-xs text-hub-textDim">No comments yet.</p>}
              {topLevel.map((c) => (
                <div key={c.id}>
                  <CommentRow comment={c} liked={!!commentLikes[c.id]?.mine} likeCount={commentLikes[c.id]?.count ?? 0} onLike={() => toggleCommentLike(post, c.id)} onReply={() => startReply(post, c.id, c.first_name || "them")} />
                  {repliesOf(c.id).length > 0 && (
                    <div className="ml-8 mt-2 flex flex-col gap-2">
                      {repliesOf(c.id).map((r) => (
                        <CommentRow key={r.id} comment={r} liked={!!commentLikes[r.id]?.mine} likeCount={commentLikes[r.id]?.count ?? 0} onLike={() => toggleCommentLike(post, r.id)} onReply={() => startReply(post, c.id, c.first_name || "them")} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {currentReply && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-hub-card2 px-2.5 py-1 text-[11px] text-hub-textDim">
                <span>Replying to {currentReply.name}</span>
                <button onClick={() => cancelReply(k)} className="text-hub-accentLight">Cancel</button>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={(el) => { commentInputRefs.current[k] = el; }}
                value={commentDraft[k] || ""}
                onChange={(e) => setCommentDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") submitComment(post); }}
                placeholder={currentReply ? `Reply to ${currentReply.name}...` : "Write a comment..."}
                className="flex-1 rounded-full border border-hub-border bg-hub-card2 px-3 py-1.5 text-xs text-white placeholder:text-hub-textDim outline-none"
              />
              <button onClick={() => submitComment(post)} disabled={commentPosting === k || !(commentDraft[k] || "").trim()} className="shrink-0 text-xs font-medium text-hub-accentLight disabled:opacity-40">
                {commentPosting === k ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
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

      <div className="px-5">
        <div className="relative -mt-12 h-24 w-24">
          <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-hub-bg bg-hub-card2 flex items-center justify-center text-2xl font-semibold text-white">
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

        {showUniInfo && profile.university && (
          <p className="mt-1 text-sm font-medium text-hub-accentLight">{profile.university}</p>
        )}
        {showUniInfo && (profile.department || profile.faculty || profile.level || profile.campus) && (
          <p className="mt-0.5 text-sm text-hub-textDim">
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
          <button onClick={() => router.push("/profile/edit")} className="flex-1 rounded-full bg-hub-accentLight py-2.5 text-sm font-semibold text-white active:opacity-80">
            Edit Profile
          </button>
          <button onClick={shareProfile} className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-hub-border py-2.5 text-sm font-semibold text-white active:bg-hub-card2">
            <ShareIcon /> Share
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 border-y border-hub-border py-3">
          <div className="flex flex-col items-center">
            <p className="text-base font-semibold text-white">{postsCount}</p>
            <p className="text-[11px] text-hub-textDim">Posts</p>
          </div>
          <div className="flex flex-col items-center border-l border-hub-border">
            <p className="text-base font-semibold text-white">0</p>
            <p className="text-[11px] text-hub-textDim">Followers</p>
          </div>
          <div className="flex flex-col items-center border-l border-hub-border">
            <p className="text-base font-semibold text-white">0</p>
            <p className="text-[11px] text-hub-textDim">Following</p>
          </div>
          <div className="flex flex-col items-center border-l border-hub-border">
            <p className="text-base font-semibold text-white">{savedCount}</p>
            <p className="text-[11px] text-hub-textDim">Saved</p>
          </div>
        </div>

        <div className="mt-1 flex border-b border-hub-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-hub-accentLight border-b-2 border-hub-accentLight"
                  : "text-hub-textDim border-b-2 border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Posts" && (
          <div className="mt-3 border-b border-hub-border pb-3">
            <div className="flex items-center gap-3 py-2">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  fullName.charAt(0).toUpperCase()
                )}
              </div>
              {!composerExpanded ? (
                <button
                  onClick={openComposer}
                  className="flex-1 rounded-full border border-hub-border bg-hub-card2 px-4 py-2.5 text-left text-sm text-hub-textDim"
                >
                  What&apos;s happening on campus?
                </button>
              ) : (
                <textarea
                  ref={composerTextRef}
                  value={composerContent}
                  onChange={(e) => setComposerContent(e.target.value)}
                  placeholder="What's happening on campus?"
                  rows={2}
                  className="flex-1 resize-none rounded-2xl border border-hub-border bg-hub-card2 px-4 py-2.5 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
              )}
            </div>

            {composerExpanded && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex justify-end">
                  <select
                    value={composerVisibility}
                    onChange={(e) => setComposerVisibility(e.target.value as "public" | "campus")}
                    className="shrink-0 rounded-lg border border-hub-border bg-hub-card2 px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="campus">Campus only</option>
                  </select>
                </div>

                {(composerImages.length > 0 || composerVideos.length > 0) && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {composerImages.map((_, i) => (
                      <button
                        key={`img-${i}`}
                        type="button"
                        onClick={() => setMediaEditTarget({ type: "image", index: i })}
                        className="aspect-square overflow-hidden rounded-lg bg-hub-card2"
                      >
                        {composerImagePreviews[i] && (
                          <img src={composerImagePreviews[i]} alt="" className="h-full w-full object-cover" />
                        )}
                      </button>
                    ))}
                    {composerVideos.map((_, i) => (
                      <button
                        key={`vid-${i}`}
                        type="button"
                        onClick={() => setMediaEditTarget({ type: "video", index: i })}
                        className="relative aspect-square overflow-hidden rounded-lg bg-hub-card2"
                      >
                        {composerVideoPreviews[i] && (
                          <video src={composerVideoPreviews[i]} className="h-full w-full object-cover" />
                        )}
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                          <VideoIcon />
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <input
                  ref={composerImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addComposerImages(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
                <input
                  ref={composerVideoInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addComposerVideos(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />

                {composerError && <p className="text-xs text-red-400">{composerError}</p>}

                <div className="flex items-center justify-end gap-3 border-t border-hub-border pt-2">
                  <button onClick={closeComposerIfEmpty} className="text-xs font-medium text-hub-textDim">
                    Cancel
                  </button>
                  <button
                    onClick={handleComposerPost}
                    disabled={composerPosting || (!composerContent.trim() && composerImages.length === 0 && composerVideos.length === 0)}
                    className="rounded-full bg-hub-accentLight px-5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {composerPosting ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-hub-border bg-hub-card">
              <button
                onClick={() => {
                  openComposer();
                  setPendingMediaTrigger("image");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-hub-textDim"
              >
                <span className="text-green-400"><PhotoIcon /></span> Photo
              </button>
              <div className="h-6 w-px shrink-0 bg-hub-border" />
              <button
                onClick={() => {
                  openComposer();
                  setPendingMediaTrigger("video");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-hub-textDim"
              >
                <span className="text-orange-400"><VideoIcon /></span> Video
              </button>
              <div className="h-6 w-px shrink-0 bg-hub-border" />
              <button
                onClick={() => router.push("/create-poll")}
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-hub-textDim"
              >
                <span className="text-purple-400"><PollIcon /></span> Poll
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
        {tabLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}

        {!tabLoading && activeTab === "Posts" && (
          <>
            {posts && posts.length === 0 && <p className="px-5 text-center text-sm text-hub-textDim">No posts yet.</p>}
            {(posts ?? []).map(renderPostCard)}
          </>
        )}

        {!tabLoading && activeTab === "Replies" && (
          <div className="flex flex-col gap-3 px-5">
            {repliesError && <p className="text-center text-sm text-red-400">Couldn&apos;t load replies: {repliesError}</p>}
            {!repliesError && replies && replies.length === 0 && <p className="text-center text-sm text-hub-textDim">No replies yet.</p>}
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
            {(saved ?? []).map(renderPostCard)}
          </>
        )}
      </div>

      {mediaEditTarget && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setMediaEditTarget(null)}>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setMediaEditTarget(null)} className="text-xl text-white">×</button>
            {mediaEditTarget.type === "image" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  rotateComposerImage(mediaEditTarget.index);
                }}
                disabled={rotating}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {rotating ? "Rotating..." : "Rotate"}
              </button>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            {mediaEditTarget.type === "image"
              ? composerImagePreviews[mediaEditTarget.index] && (
                  <img src={composerImagePreviews[mediaEditTarget.index]} alt="" className="max-h-full max-w-full object-contain" />
                )
              : composerVideoPreviews[mediaEditTarget.index] && (
                  <video src={composerVideoPreviews[mediaEditTarget.index]} controls autoPlay className="max-h-full max-w-full object-contain" />
                )}
          </div>
          <div className="p-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (mediaEditTarget.type === "image") removeComposerImage(mediaEditTarget.index);
                else removeComposerVideo(mediaEditTarget.index);
                setMediaEditTarget(null);
              }}
              className="w-full rounded-lg border border-red-400/40 py-2.5 text-sm font-medium text-red-400"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
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
function PollIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 20V10M12 20V4M19 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
