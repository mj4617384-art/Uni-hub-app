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
  REACTIONS,
  REACTION_TOP,
  REACTION_BOTTOM,
  ReactionType,
  ReactionRecord,
  Comment,
  CommentRow,
} from "@/lib/discover/shared";

type Source = "discover" | "sports";

type UnifiedPost = {
  id: string;
  source: Source;
  user_id: string;
  first_name: string;
  avatar_url: string | null;
  text: string | null;
  description: string | null;
  image_urls: string[];
  video_urls: string[];
  created_at: string;
  category: string | null;
};

const discoverTabs = ["For You", "Following", "Explore"] as const;
type DiscoverTab = (typeof discoverTabs)[number];

function keyFor(source: Source, id: string) {
  return `${source}-${id}`;
}

function tables(source: Source) {
  return source === "discover"
    ? { reactions: "discover_reactions", comments: "discover_comments", commentLikes: "discover_comment_likes", idField: "post_id" }
    : { reactions: "sports_update_reactions", comments: "sports_update_comments", commentLikes: "sports_update_comment_likes", idField: "sports_update_id" };
}

function mapDiscoverRow(p: any): UnifiedPost {
  return {
    id: p.id, source: "discover", user_id: p.user_id,
    first_name: p.profiles?.first_name ?? "Student", avatar_url: p.profiles?.avatar_url ?? null,
    text: p.content, description: null,
    image_urls: p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [],
    video_urls: p.video_urls?.length ? p.video_urls : p.video_url ? [p.video_url] : [],
    created_at: p.created_at, category: p.category ?? null,
  };
}
function mapSportsRow(s: any): UnifiedPost {
  return {
    id: s.id, source: "sports", user_id: s.user_id,
    first_name: s.profiles?.first_name ?? "Student", avatar_url: s.profiles?.avatar_url ?? null,
    text: s.title, description: s.description,
    image_urls: s.image_urls?.length ? s.image_urls : s.image_url ? [s.image_url] : [],
    video_urls: s.video_urls ?? [], created_at: s.created_at, category: s.category ?? null,
  };
}

export default function DiscoverPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DiscoverTab>("For You");

  const [forYouPosts, setForYouPosts] = useState<UnifiedPost[] | null>(null);
  const [forYouLoading, setForYouLoading] = useState(false);

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [reactionsByKey, setReactionsByKey] = useState<Record<string, ReactionRecord[]>>({});
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [commentsByKey, setCommentsByKey] = useState<Record<string, Comment[]>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentOpenFor, setCommentOpenFor] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Record<string, { commentId: string; name: string } | null>>({});
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const menuScopeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const videoObserverRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    videoObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) video.pause();
          else video.play().catch(() => {});
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
      if (menuOpenFor) {
        const scope = menuScopeRefs.current[menuOpenFor];
        if (scope && !scope.contains(e.target as Node)) setMenuOpenFor(null);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [menuOpenFor]);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);

      const { data: bookmarkRows } = await supabase
        .from("discover_post_bookmarks")
        .select("post_id")
        .eq("user_id", data.user.id);
      if (bookmarkRows) setBookmarkedIds(new Set(bookmarkRows.map((b: any) => b.post_id)));

      setLoading(false);
      await loadForYou();
    }
    init();
  }, [router]);

  async function loadForYou() {
    setForYouLoading(true);
    const { data: feedItems, error: feedErr } = await supabase
      .from("discover_feed_items")
      .select("source_type, source_id, created_at")
      .order("created_at", { ascending: false })
      .limit(40);

    if (feedErr) {
      console.error(feedErr);
      alert("Load feed failed: " + feedErr.message);
      setForYouLoading(false);
      return;
    }

    const items = feedItems ?? [];
    const discoverIds = items.filter((i) => i.source_type === "discover_post").map((i) => i.source_id);
    const sportsIds = items.filter((i) => i.source_type === "sports_update").map((i) => i.source_id);

    const [discoverRes, sportsRes] = await Promise.all([
      discoverIds.length
        ? supabase.from("discover_posts").select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").in("id", discoverIds)
        : Promise.resolve({ data: [] as any[] }),
      sportsIds.length
        ? supabase.from("sports_updates").select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").in("id", sportsIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const discoverMap = new Map((discoverRes.data ?? []).map((p: any) => [p.id, mapDiscoverRow(p)]));
    const sportsMap = new Map((sportsRes.data ?? []).map((s: any) => [s.id, mapSportsRow(s)]));

    const ordered: UnifiedPost[] = [];
    for (const item of items) {
      const post = item.source_type === "discover_post" ? discoverMap.get(item.source_id) : sportsMap.get(item.source_id);
      if (post) ordered.push(post);
    }

    setForYouPosts(ordered);
    setForYouLoading(false);
    await loadEngagementFor(ordered);
  }

  async function loadEngagementFor(items: UnifiedPost[]) {
    const discoverIds = items.filter((p) => p.source === "discover").map((p) => p.id);
    const sportsIds = items.filter((p) => p.source === "sports").map((p) => p.id);

    const [dr, dc, sr, sc] = await Promise.all([
      discoverIds.length ? supabase.from("discover_reactions").select("post_id, user_id, type, profiles(first_name)").in("post_id", discoverIds) : Promise.resolve({ data: [] as any[] }),
      discoverIds.length ? supabase.from("discover_comments").select("*, profiles(first_name)").in("post_id", discoverIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as any[] }),
      sportsIds.length ? supabase.from("sports_update_reactions").select("sports_update_id, user_id, type, profiles(first_name)").in("sports_update_id", sportsIds) : Promise.resolve({ data: [] as any[] }),
      sportsIds.length ? supabase.from("sports_update_comments").select("*, profiles(first_name)").in("sports_update_id", sportsIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as any[] }),
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
    const { data, error } = await supabase.from(t.reactions).select(`${t.idField}, user_id, type, profiles(first_name)`).eq(t.idField, post.id);
    if (error) {
      console.error(error);
      return;
    }
    setReactionsByKey((prev) => ({
      ...prev,
      [keyFor(post.source, post.id)]: (data ?? []).map((r: any) => ({ type: r.type, user_id: r.user_id, first_name: r.profiles?.first_name ?? "Student" })),
    }));
  }

  async function refreshCommentsFor(post: UnifiedPost) {
    const t = tables(post.source);
    const { data, error } = await supabase.from(t.comments).select("*, profiles(first_name)").eq(t.idField, post.id).order("created_at", { ascending: true });
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
    } else {
      await supabase.from("discover_post_bookmarks").insert({ post_id: post.id, user_id: userId });
    }
  }

  async function sharePost(post: UnifiedPost) {
    const url = post.source === "sports" ? `${window.location.origin}/discover/sports?update=${post.id}` : `${window.location.origin}/discover?post=${post.id}`;
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
    const url = post.source === "sports" ? `${window.location.origin}/discover/sports?update=${post.id}` : `${window.location.origin}/discover?post=${post.id}`;
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard");
    setMenuOpenFor(null);
  }

  function removeFromLists(post: UnifiedPost) {
    setForYouPosts((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
  }

  async function handleDeletePost(post: UnifiedPost) {
    if (!userId) return;
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    const k = keyFor(post.source, post.id);
    setDeletingKey(k);
    const table = post.source === "discover" ? "discover_posts" : "sports_updates";
    const { error } = await supabase.from(table).delete().eq("id", post.id).eq("user_id", userId);
    if (!error) {
      await supabase.from("discover_feed_items").delete()
        .eq("source_type", post.source === "discover" ? "discover_post" : "sports_update")
        .eq("source_id", post.id);
    }
    setDeletingKey(null);
    setMenuOpenFor(null);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    removeFromLists(post);
  }

  function renderReelCard(post: UnifiedPost) {
    const k = keyFor(post.source, post.id);
    const postReactions = reactionsByKey[k] || [];
    const myReaction = postReactions.find((r) => r.user_id === userId)?.type ?? null;
    const allComments = commentsByKey[k] || [];
    const topLevel = allComments.filter((c) => !c.parent_id);
    const currentReply = replyTo[k];
    const isMine = post.user_id === userId;
    const isSaved = post.source === "discover" && bookmarkedIds.has(post.id);
    const isVideo = post.video_urls.length > 0;
    const heroMedia = post.video_urls[0] || post.image_urls[0] || null;

    return (
      <div key={k} className="relative h-full w-full snap-start shrink-0 overflow-hidden bg-black">
        {heroMedia ? (
          isVideo ? (
            <video ref={registerVideoRef} src={heroMedia} muted loop playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={heroMedia} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-hub-card2 px-8 text-center text-sm text-white/80">
            {post.text || post.description || ""}
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/40 bg-hub-card2 flex items-center justify-center text-xs font-medium text-white">
              {post.avatar_url ? <img src={post.avatar_url} alt="" className="h-full w-full object-cover" /> : post.first_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{post.first_name}</p>
              <p className="text-[11px] text-white/70">{timeAgo(post.created_at)}{post.category ? ` · ${post.category}` : ""}</p>
            </div>
          </div>
          <div ref={(el) => { menuScopeRefs.current[k] = el; }} className="relative">
            <button onClick={() => setMenuOpenFor(menuOpenFor === k ? null : k)} className="text-white"><MoreIcon /></button>
            {menuOpenFor === k && (
              <div className="absolute right-0 top-9 z-30 w-44 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
                <button onClick={() => sharePost(post)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white"><ShareIcon />Share</button>
                <button onClick={() => copyLink(post)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">Copy link</button>
                {isMine && (
                  <>
                    <div className="my-1 border-t border-hub-border" />
                    <button onClick={() => handleDeletePost(post)} disabled={deletingKey === k} className="block w-full px-3 py-2 text-left text-xs text-red-400 disabled:opacity-40">
                      {deletingKey === k ? "Deleting..." : "Delete post"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-6">
          <button onClick={() => pickReaction(post, "like")} disabled={reactingKey === k} className="flex flex-col items-center gap-1">
            <ThumbsUpIcon className={myReaction ? "text-hub-accentLight" : "text-white"} filled={!!myReaction} />
            <span className="text-[13px] font-medium text-white">{postReactions.length > 0 ? postReactions.length : ""}</span>
          </button>
          <button onClick={() => setCommentOpenFor(commentOpenFor === k ? null : k)} className="flex flex-col items-center gap-1">
            <span className="text-white"><CommentIcon /></span>
            <span className="text-[13px] font-medium text-white">{allComments.length > 0 ? allComments.length : ""}</span>
          </button>
          <button onClick={() => sharePost(post)} className="flex flex-col items-center gap-1">
            <span className="text-white"><ShareIcon /></span>
          </button>
          {post.source === "discover" && (
            <button onClick={() => toggleBookmark(post)} className="flex flex-col items-center gap-1">
              <span className={isSaved ? "text-hub-accentLight" : "text-white"}><BookmarkIcon filled={isSaved} /></span>
            </button>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-14">
          <p className="pr-14 text-sm font-semibold text-white">{post.first_name}</p>
          {(post.text || post.description) && (
            <p className="mt-0.5 line-clamp-2 pr-14 text-[13px] text-white/90 whitespace-pre-wrap">
              {linkifyContent(post.text || post.description || "")}
            </p>
          )}
        </div>

        {commentOpenFor === k && (
          <div className="absolute inset-0 z-40 flex items-end bg-black/60" onClick={() => setCommentOpenFor(null)}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[65%] w-full overflow-y-auto rounded-t-2xl border-t border-hub-border bg-hub-card p-4">
              <p className="mb-3 text-sm font-semibold text-white">Comments</p>
              <div className="flex flex-col gap-3">
                {topLevel.length === 0 && <p className="text-xs text-hub-textDim">No comments yet.</p>}
                {topLevel.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    liked={!!commentLikes[c.id]?.mine}
                    likeCount={commentLikes[c.id]?.count ?? 0}
                    onLike={() => toggleCommentLike(post, c.id)}
                    onReply={() => startReply(post, c.id, c.first_name || "them")}
                  />
                ))}
              </div>
              {currentReply && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-hub-card2 px-2.5 py-1 text-[11px] text-hub-textDim">
                  <span>Replying to {currentReply.name}</span>
                  <button onClick={() => cancelReply(k)} className="text-hub-accentLight">Cancel</button>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
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
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-semibold text-white">Discover</h1>
        <div className="mt-4 flex rounded-full border border-hub-border bg-hub-card p-1">
          {discoverTabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${activeTab === tab ? "bg-hub-accentLight text-white" : "text-hub-textDim"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "For You" && (
        <div className="mt-3">
          {forYouLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}
          {!forYouLoading && forYouPosts && forYouPosts.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-hub-textDim">Nothing here yet — post something from your Profile to get started.</p>
          )}
          {!forYouLoading && forYouPosts && forYouPosts.length > 0 && (
            <div className="h-[calc(100dvh-172px)] min-h-[420px] w-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {forYouPosts.map(renderReelCard)}
            </div>
          )}
        </div>
      )}

      {activeTab === "Following" && (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-white/90">Following is coming back soon</p>
          <p className="mt-1 text-xs text-hub-textDim">We're rebuilding this in smaller pieces — check back shortly.</p>
        </div>
      )}

      {activeTab === "Explore" && (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-white/90">Explore is coming back soon</p>
          <p className="mt-1 text-xs text-hub-textDim">We're rebuilding this in smaller pieces — check back shortly.</p>
        </div>
      )}

      <BottomNav active="discover" />
    </main>
  );
}
