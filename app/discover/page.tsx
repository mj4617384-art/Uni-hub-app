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
type ReactionRecord = { type: ReactionType; user_id: string; first_name: string };

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  first_name?: string;
};

// Minimal shape shared by Discover comments and Sports comments, so one
// CommentRow component can render either.
type CommentLikeShape = {
  id: string;
  first_name?: string;
  content: string;
  created_at: string;
};

type SportsUpdate = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string;
  created_at: string;
  first_name?: string;
};

type SportsComment = {
  id: string;
  sports_update_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  first_name?: string;
};

const REACTIONS: { type: ReactionType; emoji: string | null; label: string; bg: string }[] = [
  { type: "like", emoji: null, label: "Like", bg: "bg-hub-accentLight" },
  { type: "love", emoji: "❤️", label: "Love", bg: "bg-red-500" },
  { type: "care", emoji: "🥰", label: "Care", bg: "bg-yellow-400" },
  { type: "haha", emoji: "😆", label: "Haha", bg: "bg-yellow-400" },
  { type: "wow", emoji: "😮", label: "Wow", bg: "bg-yellow-400" },
  { type: "sad", emoji: "😢", label: "Sad", bg: "bg-yellow-400" },
  { type: "angry", emoji: "😠", label: "Angry", bg: "bg-orange-500" },
];
const REACTION_TOP = REACTIONS.slice(0, 3);
const REACTION_BOTTOM = REACTIONS.slice(3);

const tabs = ["For You", "Following", "Sports", "News", "Clubs"];
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const SPORTS_CATEGORY_OPTIONS = [
  "Football",
  "Basketball",
  "Athletics",
  "Volleyball",
  "Table Tennis",
  "Handball",
  "Badminton",
  "Chess",
  "Swimming",
  "Rugby",
];

function linkifyContent(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-hub-accentLight underline break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function reactionSummaryText(records: ReactionRecord[], userId: string | null) {
  if (records.length === 0) return null;
  const mine = records.find((r) => r.user_id === userId);
  const others = records.filter((r) => r.user_id !== userId);
  if (mine && others.length === 0) return "You reacted";
  if (mine) return `You and ${others.length} other${others.length > 1 ? "s" : ""} reacted`;
  const first = records[0];
  const rest = records.length - 1;
  return rest > 0 ? `${first.first_name} and ${rest} other${rest > 1 ? "s" : ""} reacted` : `${first.first_name} reacted`;
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

  const [reactionsByPost, setReactionsByPost] = useState<Record<string, ReactionRecord[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);

  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentOpenFor, setCommentOpenFor] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Record<string, { commentId: string; name: string } | null>>({});
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [interestState, setInterestState] = useState<Record<string, "interested" | "not_interested" | null>>({});
  const [notifyOn, setNotifyOn] = useState<Record<string, boolean>>({});
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ---- Sports tab state ----
  const [sportsUpdates, setSportsUpdates] = useState<SportsUpdate[]>([]);
  const [sportsLoaded, setSportsLoaded] = useState(false);
  const [sportsLoading, setSportsLoading] = useState(false);
  const [sportsTitle, setSportsTitle] = useState("");
  const [sportsDescription, setSportsDescription] = useState("");
  const [sportsCategory, setSportsCategory] = useState("");
  const [sportsCategoryFocused, setSportsCategoryFocused] = useState(false);
  const [sportsImageFile, setSportsImageFile] = useState<File | null>(null);
  const [sportsPosting, setSportsPosting] = useState(false);
  const [sportsUploadError, setSportsUploadError] = useState<string | null>(null);
  const sportsImageInputRef = useRef<HTMLInputElement>(null);
  const sportsCategoryScopeRef = useRef<HTMLDivElement | null>(null);

  const [sportsReactionsByUpdate, setSportsReactionsByUpdate] = useState<Record<string, ReactionRecord[]>>({});
  const [sportsReactionPickerFor, setSportsReactionPickerFor] = useState<string | null>(null);
  const [sportsReactingId, setSportsReactingId] = useState<string | null>(null);
  const sportsReactionScopeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [sportsCommentsByUpdate, setSportsCommentsByUpdate] = useState<Record<string, SportsComment[]>>({});
  const [sportsCommentLikes, setSportsCommentLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [sportsCommentOpenFor, setSportsCommentOpenFor] = useState<string | null>(null);
  const [sportsCommentDraft, setSportsCommentDraft] = useState<Record<string, string>>({});
  const [sportsCommentPosting, setSportsCommentPosting] = useState<string | null>(null);
  const [sportsReplyTo, setSportsReplyTo] = useState<Record<string, { commentId: string; name: string } | null>>({});
  const sportsCommentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const reactionScopeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuScopeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const videoObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    videoObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );
    return () => videoObserverRef.current?.disconnect();
  }, []);

  function registerVideoRef(el: HTMLVideoElement | null) {
    if (el) videoObserverRef.current?.observe(el);
  }

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
      if (sportsReactionPickerFor) {
        const scope = sportsReactionScopeRefs.current[sportsReactionPickerFor];
        if (scope && !scope.contains(e.target as Node)) setSportsReactionPickerFor(null);
      }
      if (sportsCategoryFocused) {
        const scope = sportsCategoryScopeRef.current;
        if (scope && !scope.contains(e.target as Node)) setSportsCategoryFocused(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [reactionPickerFor, menuOpenFor, sportsReactionPickerFor, sportsCategoryFocused]);

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

  useEffect(() => {
    if (activeTab === "Sports" && !sportsLoaded) {
      loadSportsUpdates();
    }
  }, [activeTab, sportsLoaded]);

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

    const ids = mapped.map((p) => p.id);
    if (ids.length > 0) {
      await Promise.all([loadReactions(ids), loadComments(ids)]);
    }
  }

  async function loadReactions(postIds: string[]) {
    const { data, error } = await supabase
      .from("discover_reactions")
      .select("post_id, user_id, type, profiles(first_name)")
      .in("post_id", postIds);
    if (error) {
      console.error(error);
      return;
    }
    const grouped: Record<string, ReactionRecord[]> = {};
    (data ?? []).forEach((r: any) => {
      if (!grouped[r.post_id]) grouped[r.post_id] = [];
      grouped[r.post_id].push({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" });
    });
    setReactionsByPost(grouped);
  }

  async function refreshReactionsForPost(postId: string) {
    const { data, error } = await supabase
      .from("discover_reactions")
      .select("post_id, user_id, type, profiles(first_name)")
      .eq("post_id", postId);
    if (error) {
      console.error(error);
      return;
    }
    setReactionsByPost((prev) => ({
      ...prev,
      [postId]: (data ?? []).map((r: any) => ({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" })),
    }));
  }

  async function loadComments(postIds: string[]) {
    const { data, error } = await supabase
      .from("discover_comments")
      .select("*, profiles(first_name)")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const grouped: Record<string, Comment[]> = {};
    const allIds: string[] = [];
    (data ?? []).forEach((c: any) => {
      if (!grouped[c.post_id]) grouped[c.post_id] = [];
      grouped[c.post_id].push({ ...c, first_name: c.profiles?.first_name ?? "Student" });
      allIds.push(c.id);
    });
    setCommentsByPost(grouped);
    if (allIds.length > 0) await loadCommentLikes(allIds);
  }

  async function refreshCommentsForPost(postId: string) {
    const { data, error } = await supabase
      .from("discover_comments")
      .select("*, profiles(first_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const mapped = (data ?? []).map((c: any) => ({ ...c, first_name: c.profiles?.first_name ?? "Student" }));
    setCommentsByPost((prev) => ({ ...prev, [postId]: mapped }));
    const ids = mapped.map((c) => c.id);
    if (ids.length > 0) await loadCommentLikes(ids);
  }

  async function loadCommentLikes(commentIds: string[]) {
    const { data, error } = await supabase
      .from("discover_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);
    if (error) {
      console.error(error);
      return;
    }
    setCommentLikes((prev) => {
      const next = { ...prev };
      commentIds.forEach((id) => {
        next[id] = { count: 0, mine: false };
      });
      (data ?? []).forEach((row: any) => {
        if (!next[row.comment_id]) next[row.comment_id] = { count: 0, mine: false };
        next[row.comment_id].count += 1;
        if (row.user_id === userId) next[row.comment_id].mine = true;
      });
      return next;
    });
  }

  async function toggleCommentLike(commentId: string) {
    if (!userId) return;
    const current = commentLikes[commentId] || { count: 0, mine: false };

    if (current.mine) {
      setCommentLikes((prev) => ({ ...prev, [commentId]: { count: Math.max(0, current.count - 1), mine: false } }));
      const { error } = await supabase
        .from("discover_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId);
      if (error) {
        setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
        alert("Unlike failed: " + error.message);
      }
    } else {
      setCommentLikes((prev) => ({ ...prev, [commentId]: { count: current.count + 1, mine: true } }));
      const { error } = await supabase
        .from("discover_comment_likes")
        .insert({ comment_id: commentId, user_id: userId });
      if (error) {
        setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
        alert("Like failed: " + error.message);
      }
    }
  }

  async function handlePost() {
    if (!userId || (!content.trim() && !imageFile && !videoFile)) return;
    setPosting(true);
    setUploadError(null);

    let image_url: string | null = null;
    let video_url: string | null = null;

    if (imageFile) {
      const path = `${userId}/${Date.now()}-${imageFile.name}`;
      const { error: upErr } = await supabase.storage.from("discover-images").upload(path, imageFile);
      if (upErr) {
        setUploadError("Image upload failed: " + upErr.message);
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("discover-images").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    if (videoFile) {
      const path = `${userId}/${Date.now()}-${videoFile.name}`;
      const { error: upErr } = await supabase.storage.from("discover-videos").upload(path, videoFile);
      if (upErr) {
        setUploadError("Video upload failed: " + upErr.message);
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("discover-videos").getPublicUrl(path);
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
    if (!window.confirm("Delete this post? This can't be undone.")) return;

    setDeletingId(postId);
    const { error } = await supabase.from("discover_posts").delete().eq("id", postId).eq("user_id", userId);
    setDeletingId(null);
    setMenuOpenFor(null);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  async function pickReaction(postId: string, type: ReactionType) {
    if (!userId) return;
    setReactingId(postId);
    const existing = (reactionsByPost[postId] || []).find((r) => r.user_id === userId);

    if (existing && existing.type === type) {
      const { error } = await supabase.from("discover_reactions").delete().eq("post_id", postId).eq("user_id", userId);
      if (error) alert("Reaction failed: " + error.message);
    } else {
      const { error } = await supabase
        .from("discover_reactions")
        .upsert({ post_id: postId, user_id: userId, type }, { onConflict: "post_id,user_id" });
      if (error) alert("Reaction failed: " + error.message);
    }

    await refreshReactionsForPost(postId);
    setReactingId(null);
    setReactionPickerFor(null);
  }

  function toggleReactionButton(postId: string) {
    setReactionPickerFor((prev) => (prev === postId ? null : postId));
  }

  function startReply(postId: string, commentId: string, name: string) {
    setReplyTo((prev) => ({ ...prev, [postId]: { commentId, name } }));
    setCommentOpenFor(postId);
    setTimeout(() => commentInputRefs.current[postId]?.focus(), 0);
  }

  function cancelReply(postId: string) {
    setReplyTo((prev) => ({ ...prev, [postId]: null }));
  }

  async function submitComment(postId: string) {
    if (!userId) return;
    const text = (commentDraft[postId] || "").trim();
    if (!text) return;

    setCommentPosting(postId);
    const parentId = replyTo[postId]?.commentId ?? null;
    const { error } = await supabase.from("discover_comments").insert({
      post_id: postId,
      user_id: userId,
      parent_id: parentId,
      content: text,
    });
    setCommentPosting(null);

    if (error) {
      alert("Comment failed: " + error.message);
      return;
    }

    setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
    setReplyTo((prev) => ({ ...prev, [postId]: null }));
    await refreshCommentsForPost(postId);
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
        // cancelled
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
    setInterestState((prev) => ({ ...prev, [postId]: prev[postId] === val ? null : val }));
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

  // ---- Sports tab logic ----

  async function loadSportsUpdates() {
    setSportsLoading(true);
    const { data, error } = await supabase
      .from("sports_updates")
      .select("*, profiles(first_name)")
      .order("created_at", { ascending: false });

    setSportsLoading(false);
    setSportsLoaded(true);

    if (error) {
      console.error(error);
      alert("Load sports updates failed: " + error.message);
      return;
    }

    const mapped = (data ?? []).map((s: any) => ({
      ...s,
      first_name: s.profiles?.first_name ?? "Student",
    }));
    setSportsUpdates(mapped);

    const ids = mapped.map((s) => s.id);
    if (ids.length > 0) {
      await Promise.all([loadSportsReactions(ids), loadSportsCommentsFor(ids)]);
    }
  }

  async function loadSportsReactions(updateIds: string[]) {
    const { data, error } = await supabase
      .from("sports_update_reactions")
      .select("sports_update_id, user_id, type, profiles(first_name)")
      .in("sports_update_id", updateIds);
    if (error) {
      console.error(error);
      return;
    }
    const grouped: Record<string, ReactionRecord[]> = {};
    (data ?? []).forEach((r: any) => {
      if (!grouped[r.sports_update_id]) grouped[r.sports_update_id] = [];
      grouped[r.sports_update_id].push({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" });
    });
    setSportsReactionsByUpdate(grouped);
  }

  async function refreshSportsReactionsForUpdate(updateId: string) {
    const { data, error } = await supabase
      .from("sports_update_reactions")
      .select("sports_update_id, user_id, type, profiles(first_name)")
      .eq("sports_update_id", updateId);
    if (error) {
      console.error(error);
      return;
    }
    setSportsReactionsByUpdate((prev) => ({
      ...prev,
      [updateId]: (data ?? []).map((r: any) => ({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" })),
    }));
  }

  async function pickSportsReaction(updateId: string, type: ReactionType) {
    if (!userId) return;
    setSportsReactingId(updateId);
    const existing = (sportsReactionsByUpdate[updateId] || []).find((r) => r.user_id === userId);

    if (existing && existing.type === type) {
      const { error } = await supabase
        .from("sports_update_reactions")
        .delete()
        .eq("sports_update_id", updateId)
        .eq("user_id", userId);
      if (error) alert("Reaction failed: " + error.message);
    } else {
      const { error } = await supabase
        .from("sports_update_reactions")
        .upsert({ sports_update_id: updateId, user_id: userId, type }, { onConflict: "sports_update_id,user_id" });
      if (error) alert("Reaction failed: " + error.message);
    }

    await refreshSportsReactionsForUpdate(updateId);
    setSportsReactingId(null);
    setSportsReactionPickerFor(null);
  }

  function toggleSportsReactionButton(updateId: string) {
    setSportsReactionPickerFor((prev) => (prev === updateId ? null : updateId));
  }

  async function loadSportsCommentsFor(updateIds: string[]) {
    const { data, error } = await supabase
      .from("sports_update_comments")
      .select("*, profiles(first_name)")
      .in("sports_update_id", updateIds)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const grouped: Record<string, SportsComment[]> = {};
    const allIds: string[] = [];
    (data ?? []).forEach((c: any) => {
      if (!grouped[c.sports_update_id]) grouped[c.sports_update_id] = [];
      grouped[c.sports_update_id].push({ ...c, first_name: c.profiles?.first_name ?? "Student" });
      allIds.push(c.id);
    });
    setSportsCommentsByUpdate((prev) => ({ ...prev, ...grouped }));
    if (allIds.length > 0) await loadSportsCommentLikes(allIds);
  }

  async function refreshSportsCommentsForUpdate(updateId: string) {
    const { data, error } = await supabase
      .from("sports_update_comments")
      .select("*, profiles(first_name)")
      .eq("sports_update_id", updateId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const mapped = (data ?? []).map((c: any) => ({ ...c, first_name: c.profiles?.first_name ?? "Student" }));
    setSportsCommentsByUpdate((prev) => ({ ...prev, [updateId]: mapped }));
    const ids = mapped.map((c) => c.id);
    if (ids.length > 0) await loadSportsCommentLikes(ids);
  }

  async function loadSportsCommentLikes(commentIds: string[]) {
    const { data, error } = await supabase
      .from("sports_update_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);
    if (error) {
      console.error(error);
      return;
    }
    setSportsCommentLikes((prev) => {
      const next = { ...prev };
      commentIds.forEach((id) => {
        next[id] = { count: 0, mine: false };
      });
      (data ?? []).forEach((row: any) => {
        if (!next[row.comment_id]) next[row.comment_id] = { count: 0, mine: false };
        next[row.comment_id].count += 1;
        if (row.user_id === userId) next[row.comment_id].mine = true;
      });
      return next;
    });
  }

  async function toggleSportsCommentLike(commentId: string) {
    if (!userId) return;
    const current = sportsCommentLikes[commentId] || { count: 0, mine: false };

    if (current.mine) {
      setSportsCommentLikes((prev) => ({ ...prev, [commentId]: { count: Math.max(0, current.count - 1), mine: false } }));
      const { error } = await supabase
        .from("sports_update_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId);
      if (error) {
        setSportsCommentLikes((prev) => ({ ...prev, [commentId]: current }));
        alert("Unlike failed: " + error.message);
      }
    } else {
      setSportsCommentLikes((prev) => ({ ...prev, [commentId]: { count: current.count + 1, mine: true } }));
      const { error } = await supabase
        .from("sports_update_comment_likes")
        .insert({ comment_id: commentId, user_id: userId });
      if (error) {
        setSportsCommentLikes((prev) => ({ ...prev, [commentId]: current }));
        alert("Like failed: " + error.message);
      }
    }
  }

  function startSportsReply(updateId: string, commentId: string, name: string) {
    setSportsReplyTo((prev) => ({ ...prev, [updateId]: { commentId, name } }));
    setSportsCommentOpenFor(updateId);
    setTimeout(() => sportsCommentInputRefs.current[updateId]?.focus(), 0);
  }

  function cancelSportsReply(updateId: string) {
    setSportsReplyTo((prev) => ({ ...prev, [updateId]: null }));
  }

  async function submitSportsComment(updateId: string) {
    if (!userId) return;
    const text = (sportsCommentDraft[updateId] || "").trim();
    if (!text) return;

    setSportsCommentPosting(updateId);
    const parentId = sportsReplyTo[updateId]?.commentId ?? null;
    const { error } = await supabase.from("sports_update_comments").insert({
      sports_update_id: updateId,
      user_id: userId,
      parent_id: parentId,
      content: text,
    });
    setSportsCommentPosting(null);

    if (error) {
      alert("Comment failed: " + error.message);
      return;
    }

    setSportsCommentDraft((prev) => ({ ...prev, [updateId]: "" }));
    setSportsReplyTo((prev) => ({ ...prev, [updateId]: null }));
    await refreshSportsCommentsForUpdate(updateId);
  }

  function filteredCategorySuggestions() {
    const q = sportsCategory.trim().toLowerCase();
    if (!q) return SPORTS_CATEGORY_OPTIONS;
    return SPORTS_CATEGORY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }

  async function handleSportsPost() {
    if (!userId || !sportsTitle.trim() || !sportsCategory.trim()) return;
    setSportsPosting(true);
    setSportsUploadError(null);

    let image_url: string | null = null;

    if (sportsImageFile) {
      const path = `${userId}/${Date.now()}-${sportsImageFile.name}`;
      const { error: upErr } = await supabase.storage.from("sports-images").upload(path, sportsImageFile);
      if (upErr) {
        setSportsUploadError("Image upload failed: " + upErr.message);
        setSportsPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("sports-images").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const { error } = await supabase.from("sports_updates").insert({
      user_id: userId,
      title: sportsTitle.trim(),
      description: sportsDescription.trim() || null,
      image_url,
      category: sportsCategory.trim(),
    });

    if (error) {
      setSportsUploadError("Post failed: " + error.message);
      setSportsPosting(false);
      return;
    }

    setSportsTitle("");
    setSportsDescription("");
    setSportsCategory("");
    setSportsImageFile(null);
    await loadSportsUpdates();
    setSportsPosting(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  const visiblePosts = activeTab === "For You" ? posts : [];
  const trendingSportsUpdate = sportsUpdates.find((s) => s.image_url) ?? sportsUpdates[0] ?? null;
  const recentSportsUpdates = trendingSportsUpdate
    ? sportsUpdates.filter((s) => s.id !== trendingSportsUpdate.id)
    : sportsUpdates;

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
              <button onClick={() => setImageFile(null)} className="text-red-400 shrink-0">Remove</button>
            </div>
          )}
          {videoFile && (
            <div className="mt-2 flex items-center gap-2 text-xs text-hub-textDim">
              <VideoIcon />
              <span>{videoFile.name}</span>
              <button onClick={() => setVideoFile(null)} className="text-red-400 shrink-0">Remove</button>
            </div>
          )}
          {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}

          <div className="mt-3 flex items-center justify-between border-t border-hub-border pt-3">
            <div className="flex items-center gap-5">
              <button type="button" onClick={() => imageInputRef.current?.click()} className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim">
                <PhotoIcon /><span>Photo</span>
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setImageFile(e.target.files[0]); }} />
              <button type="button" onClick={() => videoInputRef.current?.click()} className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim">
                <VideoIcon /><span>Video</span>
              </button>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setVideoFile(e.target.files[0]); }} />
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

      {activeTab === "Sports" && (
        <>
          <div className="px-5">
            {/* Composer */}
            <div className="mt-4 rounded-xl border border-hub-border bg-hub-card p-3">
              <input
                value={sportsTitle}
                onChange={(e) => setSportsTitle(e.target.value)}
                placeholder="Update title (e.g. UniLafia FC wins inter-faculty match)"
                className="w-full bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
              />
              <textarea
                value={sportsDescription}
                onChange={(e) => setSportsDescription(e.target.value)}
                placeholder="Add more details (optional)"
                rows={2}
                className="mt-2 w-full resize-none bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
              />

              <div ref={sportsCategoryScopeRef} className="relative mt-2">
                <input
                  value={sportsCategory}
                  onChange={(e) => setSportsCategory(e.target.value)}
                  onFocus={() => setSportsCategoryFocused(true)}
                  placeholder="Category (e.g. Football, Basketball...)"
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-xs text-white placeholder:text-hub-textDim outline-none"
                />
                {sportsCategoryFocused && filteredCategorySuggestions().length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
                    {filteredCategorySuggestions().map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setSportsCategory(c);
                          setSportsCategoryFocused(false);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-white/90 hover:text-hub-accentLight"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {sportsImageFile && (
                <div className="mt-2 flex items-center gap-2 text-xs text-hub-textDim">
                  <PhotoIcon />
                  <span>{sportsImageFile.name}</span>
                  <button onClick={() => setSportsImageFile(null)} className="text-red-400 shrink-0">Remove</button>
                </div>
              )}
              {sportsUploadError && <p className="mt-2 text-xs text-red-400">{sportsUploadError}</p>}

              <div className="mt-3 flex items-center justify-between border-t border-hub-border pt-3">
                <button type="button" onClick={() => sportsImageInputRef.current?.click()} className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim">
                  <PhotoIcon /><span>Photo</span>
                </button>
                <input ref={sportsImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setSportsImageFile(e.target.files[0]); }} />
                <button
                  onClick={handleSportsPost}
                  disabled={sportsPosting || !sportsTitle.trim() || !sportsCategory.trim()}
                  className="shrink-0 rounded-lg bg-hub-accentLight px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {sportsPosting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>

            {trendingSportsUpdate && (
              <h2 className="mt-5 text-sm font-medium text-white">Trending Sports</h2>
            )}
          </div>

          {trendingSportsUpdate && (
            <SportsCard
              update={trendingSportsUpdate}
              userId={userId}
              reactions={sportsReactionsByUpdate[trendingSportsUpdate.id] || []}
              reactionPickerOpen={sportsReactionPickerFor === trendingSportsUpdate.id}
              reacting={sportsReactingId === trendingSportsUpdate.id}
              onToggleReactionPicker={() => toggleSportsReactionButton(trendingSportsUpdate.id)}
              onPickReaction={(type) => pickSportsReaction(trendingSportsUpdate.id, type)}
              scopeRef={(el) => { sportsReactionScopeRefs.current[trendingSportsUpdate.id] = el; }}
              comments={sportsCommentsByUpdate[trendingSportsUpdate.id] || []}
              commentLikes={sportsCommentLikes}
              commentsOpen={sportsCommentOpenFor === trendingSportsUpdate.id}
              commentDraft={sportsCommentDraft[trendingSportsUpdate.id] || ""}
              commentPosting={sportsCommentPosting === trendingSportsUpdate.id}
              currentReply={sportsReplyTo[trendingSportsUpdate.id] ?? null}
              onToggleComments={() => setSportsCommentOpenFor(sportsCommentOpenFor === trendingSportsUpdate.id ? null : trendingSportsUpdate.id)}
              onDraftChange={(v) => setSportsCommentDraft((prev) => ({ ...prev, [trendingSportsUpdate.id]: v }))}
              onSubmitComment={() => submitSportsComment(trendingSportsUpdate.id)}
              onToggleCommentLike={toggleSportsCommentLike}
              onStartReply={(commentId, name) => startSportsReply(trendingSportsUpdate.id, commentId, name)}
              onCancelReply={() => cancelSportsReply(trendingSportsUpdate.id)}
              inputRef={(el) => { sportsCommentInputRefs.current[trendingSportsUpdate.id] = el; }}
            />
          )}

          <div className="px-5">
            <h2 className="mt-5 text-sm font-medium text-white">Recent Updates</h2>
            {sportsLoading && <p className="mt-2 text-xs text-hub-textDim">Loading...</p>}
            {!sportsLoading && sportsUpdates.length === 0 && (
              <p className="mt-2 text-xs text-hub-textDim">No sports updates yet — be the first to share one!</p>
            )}
          </div>

          {recentSportsUpdates.map((s) => (
            <SportsCard
              key={s.id}
              update={s}
              userId={userId}
              reactions={sportsReactionsByUpdate[s.id] || []}
              reactionPickerOpen={sportsReactionPickerFor === s.id}
              reacting={sportsReactingId === s.id}
              onToggleReactionPicker={() => toggleSportsReactionButton(s.id)}
              onPickReaction={(type) => pickSportsReaction(s.id, type)}
              scopeRef={(el) => { sportsReactionScopeRefs.current[s.id] = el; }}
              comments={sportsCommentsByUpdate[s.id] || []}
              commentLikes={sportsCommentLikes}
              commentsOpen={sportsCommentOpenFor === s.id}
              commentDraft={sportsCommentDraft[s.id] || ""}
              commentPosting={sportsCommentPosting === s.id}
              currentReply={sportsReplyTo[s.id] ?? null}
              onToggleComments={() => setSportsCommentOpenFor(sportsCommentOpenFor === s.id ? null : s.id)}
              onDraftChange={(v) => setSportsCommentDraft((prev) => ({ ...prev, [s.id]: v }))}
              onSubmitComment={() => submitSportsComment(s.id)}
              onToggleCommentLike={toggleSportsCommentLike}
              onStartReply={(commentId, name) => startSportsReply(s.id, commentId, name)}
              onCancelReply={() => cancelSportsReply(s.id)}
              inputRef={(el) => { sportsCommentInputRefs.current[s.id] = el; }}
            />
          ))}
        </>
      )}

      <div className="mt-4">
        {activeTab !== "For You" && activeTab !== "Sports" && (
          <p className="px-5 text-center text-sm text-hub-textDim">{activeTab} isn&apos;t live yet — check back soon.</p>
        )}
        {activeTab === "For You" && visiblePosts.length === 0 && (
          <p className="px-5 text-center text-sm text-hub-textDim">No posts yet — be the first to share something!</p>
        )}

        {visiblePosts.map((post) => {
          const postReactions = reactionsByPost[post.id] || [];
          const myReaction = postReactions.find((r) => r.user_id === userId)?.type ?? null;
          const activeReactionInfo = REACTIONS.find((r) => r.type === myReaction);
          const summaryText = reactionSummaryText(postReactions, userId);
          const allComments = commentsByPost[post.id] || [];
          const topLevel = allComments.filter((c) => !c.parent_id);
          const repliesOf = (id: string) => allComments.filter((c) => c.parent_id === id);
          const isMine = post.user_id === userId;
          const currentReply = replyTo[post.id];

          return (
            <div key={post.id} className="relative border-b border-hub-border bg-hub-card px-4 py-3">
              <div ref={(el) => { menuScopeRefs.current[post.id] = el; }} className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                      {post.first_name?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{post.first_name}</p>
                      <p className="text-xs text-hub-textDim">
                        {timeAgo(post.created_at)}{post.department ? ` · ${post.department}` : ""}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setMenuOpenFor(menuOpenFor === post.id ? null : post.id)} className="shrink-0 text-hub-textDim px-1">
                    <MoreIcon />
                  </button>
                </div>

                {menuOpenFor === post.id && (
                  <div className="absolute right-0 top-12 z-20 w-56 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
                    <button onClick={() => setInterest(post.id, "interested")} className="flex w-full items-start gap-3 px-3 py-2 text-left">
                      <PlusCircleIcon />
                      <span>
                        <span className="block text-xs font-medium text-white">{interestState[post.id] === "interested" ? "Marked Interested" : "Interested"}</span>
                        <span className="block text-[10px] text-hub-textDim">More posts like this</span>
                      </span>
                    </button>
                    <button onClick={() => setInterest(post.id, "not_interested")} className="flex w-full items-start gap-3 px-3 py-2 text-left">
                      <MinusCircleIcon />
                      <span>
                        <span className="block text-xs font-medium text-white">{interestState[post.id] === "not_interested" ? "Marked Not interested" : "Not interested"}</span>
                        <span className="block text-[10px] text-hub-textDim">Fewer posts like this</span>
                      </span>
                    </button>
                    <div className="my-1 border-t border-hub-border" />
                    <button onClick={() => toggleBookmark(post.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <BookmarkIcon filled={!!bookmarked[post.id]} />{bookmarked[post.id] ? "Saved" : "Save post"}
                    </button>
                    <button onClick={() => sharePost(post)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <ShareIcon />Share
                    </button>
                    <button onClick={() => hidePost(post.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <EyeOffIcon />I don&apos;t want to see this
                    </button>
                    <button onClick={reportPost} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <FlagIcon />Report post
                    </button>
                    <button onClick={() => toggleNotify(post.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <BellSmallIcon />{notifyOn[post.id] ? "Turn off notifications" : "Turn on notifications"}
                    </button>
                    <button onClick={() => copyLink(post)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <LinkIcon />Copy link
                    </button>
                    {isMine && (
                      <>
                        <div className="my-1 border-t border-hub-border" />
                        <button onClick={() => handleDeletePost(post.id)} disabled={deletingId === post.id} className="block w-full px-3 py-2 text-left text-xs text-red-400 disabled:opacity-40">
                          {deletingId === post.id ? "Deleting..." : "Delete post"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {post.content && (
                <p className="mt-3 text-sm text-white/90 whitespace-pre-wrap">{linkifyContent(post.content)}</p>
              )}

              {post.image_url && (
                <div className="-mx-4 mt-3 overflow-hidden">
                  <img src={post.image_url} alt="Post image" loading="lazy" className="block w-full object-cover" style={{ borderRadius: 0 }} />
                </div>
              )}
              {post.video_url && (
                <div className="-mx-4 mt-3 overflow-hidden bg-black">
                  <video
                    ref={registerVideoRef}
                    src={post.video_url}
                    controls
                    preload="metadata"
                    className="block w-full"
                    style={{ borderRadius: 0 }}
                  />
                </div>
              )}

              {summaryText && <p className="mt-3 text-xs text-hub-textDim">{summaryText}</p>}

              <div
                ref={(el) => { reactionScopeRefs.current[post.id] = el; }}
                className="relative mt-2 flex items-center justify-between border-t border-hub-border pt-3"
              >
                {reactionPickerFor === post.id && (
                  <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-hub-border bg-hub-card2 px-4 py-3 shadow-xl">
                    <div className="flex items-start gap-4">
                      {REACTION_TOP.map((r) => (
                        <button
                          key={r.type}
                          onClick={() => pickReaction(post.id, r.type)}
                          disabled={reactingId === post.id}
                          className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                            {r.type === "like" ? <ThumbsUpIcon className="text-white" filled /> : <span className="text-lg leading-none">{r.emoji}</span>}
                          </span>
                          <span className="text-[10px] text-hub-textDim">{r.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-start gap-4">
                      {REACTION_BOTTOM.map((r) => (
                        <button
                          key={r.type}
                          onClick={() => pickReaction(post.id, r.type)}
                          disabled={reactingId === post.id}
                          className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                            <span className="text-lg leading-none">{r.emoji}</span>
                          </span>
                          <span className="text-[10px] text-hub-textDim">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-6">
                  <button
                    onClick={() => toggleReactionButton(post.id)}
                    className={`flex items-center gap-1.5 text-xs ${activeReactionInfo ? "text-hub-accentLight" : "text-hub-textDim"}`}
                  >
                    {activeReactionInfo ? (
                      activeReactionInfo.type === "like" ? <ThumbsUpIcon className="text-hub-accentLight" filled /> : <span className="text-base leading-none">{activeReactionInfo.emoji}</span>
                    ) : (
                      <ThumbsUpIcon className="text-hub-textDim" />
                    )}
                    {postReactions.length > 0 && <span>{postReactions.length}</span>}
                  </button>
                  <button onClick={() => setCommentOpenFor(commentOpenFor === post.id ? null : post.id)} className="flex items-center gap-1.5 text-xs text-hub-textDim">
                    <CommentIcon />
                    {allComments.length > 0 && <span>{allComments.length}</span>}
                  </button>
                  <button onClick={() => sharePost(post)} className="flex items-center gap-1.5 text-xs text-hub-textDim">
                    <ShareIcon />
                  </button>
                </div>
                <button onClick={() => toggleBookmark(post.id)} className={`shrink-0 ${bookmarked[post.id] ? "text-hub-accentLight" : "text-hub-textDim"}`}>
                  <BookmarkIcon filled={!!bookmarked[post.id]} />
                </button>
              </div>

              {commentOpenFor === post.id && (
                <div className="mt-3 border-t border-hub-border pt-3">
                  <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
                    {topLevel.length === 0 && <p className="text-xs text-hub-textDim">No comments yet — be the first.</p>}
                    {topLevel.map((c) => (
                      <div key={c.id}>
                        <CommentRow
                          comment={c}
                          liked={!!commentLikes[c.id]?.mine}
                          likeCount={commentLikes[c.id]?.count ?? 0}
                          onLike={() => toggleCommentLike(c.id)}
                          onReply={() => startReply(post.id, c.id, c.first_name || "them")}
                        />
                        {repliesOf(c.id).length > 0 && (
                          <div className="ml-8 mt-2 flex flex-col gap-2">
                            {repliesOf(c.id).map((r) => (
                              <CommentRow
                                key={r.id}
                                comment={r}
                                liked={!!commentLikes[r.id]?.mine}
                                likeCount={commentLikes[r.id]?.count ?? 0}
                                onLike={() => toggleCommentLike(r.id)}
                                onReply={() => startReply(post.id, c.id, c.first_name || "them")}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {currentReply && (
                    <div className="mt-2 flex items-center justify-between rounded-md bg-hub-card2 px-2.5 py-1 text-[11px] text-hub-textDim">
                      <span>Replying to {currentReply.name}</span>
                      <button onClick={() => cancelReply(post.id)} className="text-hub-accentLight">Cancel</button>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={(el) => { commentInputRefs.current[post.id] = el; }}
                      value={commentDraft[post.id] || ""}
                      onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") submitComment(post.id); }}
                      placeholder={currentReply ? `Reply to ${currentReply.name}...` : "Write a comment..."}
                      className="flex-1 rounded-full border border-hub-border bg-hub-card2 px-3 py-1.5 text-xs text-white placeholder:text-hub-textDim outline-none"
                    />
                    <button
                      onClick={() => submitComment(post.id)}
                      disabled={commentPosting === post.id || !(commentDraft[post.id] || "").trim()}
                      className="shrink-0 text-xs font-medium text-hub-accentLight disabled:opacity-40"
                    >
                      {commentPosting === post.id ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav />
    </main>
  );
}

function CommentRow({
  comment,
  liked,
  likeCount,
  onLike,
  onReply,
}: {
  comment: CommentLikeShape;
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  onReply: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="h-6 w-6 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-[10px] font-medium text-white">
        {comment.first_name?.charAt(0).toUpperCase() ?? "U"}
      </div>
      <div className="flex-1">
        <div className="relative inline-block rounded-lg bg-hub-card2 px-2.5 py-1.5">
          <p className="text-[11px] font-medium text-white">{comment.first_name}</p>
          <p className="text-xs text-white/90 whitespace-pre-wrap">{linkifyContent(comment.content)}</p>
          {likeCount > 0 && (
            <span className="absolute -bottom-1.5 -right-1.5 flex items-center gap-0.5 rounded-full border border-hub-border bg-hub-card px-1 py-0.5 text-[9px] text-hub-textDim">
              <ThumbsUpIcon className="text-hub-accentLight" filled small />
              {likeCount}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 pl-1 text-[10px]">
          <button onClick={onLike} className={liked ? "font-semibold text-hub-accentLight" : "font-semibold text-hub-textDim"}>
            Like
          </button>
          <button onClick={onReply} className="font-semibold text-hub-textDim">Reply</button>
          <span className="text-hub-textDim">{timeAgo(comment.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function SportsCard({
  update,
  userId,
  reactions,
  reactionPickerOpen,
  reacting,
  onToggleReactionPicker,
  onPickReaction,
  scopeRef,
  comments,
  commentLikes,
  commentsOpen,
  commentDraft,
  commentPosting,
  currentReply,
  onToggleComments,
  onDraftChange,
  onSubmitComment,
  onToggleCommentLike,
  onStartReply,
  onCancelReply,
  inputRef,
}: {
  update: SportsUpdate;
  userId: string | null;
  reactions: ReactionRecord[];
  reactionPickerOpen: boolean;
  reacting: boolean;
  onToggleReactionPicker: () => void;
  onPickReaction: (type: ReactionType) => void;
  scopeRef: (el: HTMLDivElement | null) => void;
  comments: SportsComment[];
  commentLikes: Record<string, { count: number; mine: boolean }>;
  commentsOpen: boolean;
  commentDraft: string;
  commentPosting: boolean;
  currentReply: { commentId: string; name: string } | null;
  onToggleComments: () => void;
  onDraftChange: (v: string) => void;
  onSubmitComment: () => void;
  onToggleCommentLike: (commentId: string) => void;
  onStartReply: (commentId: string, name: string) => void;
  onCancelReply: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const myReaction = reactions.find((r) => r.user_id === userId)?.type ?? null;
  const activeReactionInfo = REACTIONS.find((r) => r.type === myReaction);
  const summaryText = reactionSummaryText(reactions, userId);
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="relative border-b border-hub-border bg-hub-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
          {update.first_name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{update.first_name}</p>
          <p className="text-xs text-hub-textDim">{timeAgo(update.created_at)} · {update.category}</p>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-white">{update.title}</p>
      {update.description && (
        <p className="mt-1 text-sm text-white/90 whitespace-pre-wrap">{update.description}</p>
      )}

      {update.image_url && (
        <div className="-mx-4 mt-3 overflow-hidden">
          <img src={update.image_url} alt={update.title} loading="lazy" className="block w-full object-cover" style={{ borderRadius: 0 }} />
        </div>
      )}

      {summaryText && <p className="mt-3 text-xs text-hub-textDim">{summaryText}</p>}

      <div ref={scopeRef} className="relative mt-2 flex items-center justify-between border-t border-hub-border pt-3">
        {reactionPickerOpen && (
          <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-hub-border bg-hub-card2 px-4 py-3 shadow-xl">
            <div className="flex items-start gap-4">
              {REACTION_TOP.map((r) => (
                <button
                  key={r.type}
                  onClick={() => onPickReaction(r.type)}
                  disabled={reacting}
                  className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                    {r.type === "like" ? <ThumbsUpIcon className="text-white" filled /> : <span className="text-lg leading-none">{r.emoji}</span>}
                  </span>
                  <span className="text-[10px] text-hub-textDim">{r.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-4">
              {REACTION_BOTTOM.map((r) => (
                <button
                  key={r.type}
                  onClick={() => onPickReaction(r.type)}
                  disabled={reacting}
                  className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                    <span className="text-lg leading-none">{r.emoji}</span>
                  </span>
                  <span className="text-[10px] text-hub-textDim">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-6">
          <button
            onClick={onToggleReactionPicker}
            className={`flex items-center gap-1.5 text-xs ${activeReactionInfo ? "text-hub-accentLight" : "text-hub-textDim"}`}
          >
            {activeReactionInfo ? (
              activeReactionInfo.type === "like" ? <ThumbsUpIcon className="text-hub-accentLight" filled /> : <span className="text-base leading-none">{activeReactionInfo.emoji}</span>
            ) : (
              <ThumbsUpIcon className="text-hub-textDim" />
            )}
            {reactions.length > 0 && <span>{reactions.length}</span>}
          </button>
          <button onClick={onToggleComments} className="flex items-center gap-1.5 text-xs text-hub-textDim">
            <CommentIcon />
            {comments.length > 0 && <span>{comments.length}</span>}
          </button>
        </div>
      </div>

      {commentsOpen && (
        <div className="mt-3 border-t border-hub-border pt-3">
          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
            {topLevel.length === 0 && <p className="text-xs text-hub-textDim">No comments yet — be the first.</p>}
            {topLevel.map((c) => (
              <div key={c.id}>
                <CommentRow
                  comment={c}
                  liked={!!commentLikes[c.id]?.mine}
                  likeCount={commentLikes[c.id]?.count ?? 0}
                  onLike={() => onToggleCommentLike(c.id)}
                  onReply={() => onStartReply(c.id, c.first_name || "them")}
                />
                {repliesOf(c.id).length > 0 && (
                  <div className="ml-8 mt-2 flex flex-col gap-2">
                    {repliesOf(c.id).map((r) => (
                      <CommentRow
                        key={r.id}
                        comment={r}
                        liked={!!commentLikes[r.id]?.mine}
                        likeCount={commentLikes[r.id]?.count ?? 0}
                        onLike={() => onToggleCommentLike(r.id)}
                        onReply={() => onStartReply(c.id, c.first_name || "them")}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {currentReply && (
            <div className="mt-2 flex items-center justify-between rounded-md bg-hub-card2 px-2.5 py-1 text-[11px] text-hub-textDim">
              <span>Replying to {currentReply.name}</span>
              <button onClick={onCancelReply} className="text-hub-accentLight">Cancel</button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={inputRef}
              value={commentDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmitComment(); }}
              placeholder={currentReply ? `Reply to ${currentReply.name}...` : "Write a comment..."}
              className="flex-1 rounded-full border border-hub-border bg-hub-card2 px-3 py-1.5 text-xs text-white placeholder:text-hub-textDim outline-none"
            />
            <button
              onClick={onSubmitComment}
              disabled={commentPosting || !commentDraft.trim()}
              className="shrink-0 text-xs font-medium text-hub-accentLight disabled:opacity-40"
            >
              {commentPosting ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
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
function ThumbsUpIcon({ className, filled, small }: { className?: string; filled?: boolean; small?: boolean }) {
  const size = small ? 10 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={className}>
      <path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm0 0l4.5-8a2 2 0 013.7 1.6L14 9h5a2 2 0 012 2.2l-1.3 7A2 2 0 0117.7 20H10a3 3 0 01-3-3v-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
      <path d="M10.6 5.1A10.9 10.9 0 0112 5c5 0 9 4 10 7-.5 1.2-1.5 2.8-3 4.1M6.5 6.6C4.2 8 2.6 10.1 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 3.9-.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
