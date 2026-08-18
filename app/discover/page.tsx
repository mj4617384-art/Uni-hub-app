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
  MediaCarousel,
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

const EXPLORE_CATEGORIES = [
  "Campus Life",
  "News",
  "Sports",
  "Videos",
  "Clubs",
  "Events",
  "Marketplace",
  "Study",
];

const discoverTabs = ["For You", "Following", "Explore"] as const;
type DiscoverTab = (typeof discoverTabs)[number];

function keyFor(source: Source, id: string) {
  return `${source}-${id}`;
}

function tables(source: Source) {
  return source === "discover"
    ? {
        reactions: "discover_reactions",
        comments: "discover_comments",
        commentLikes: "discover_comment_likes",
        idField: "post_id",
      }
    : {
        reactions: "sports_update_reactions",
        comments: "sports_update_comments",
        commentLikes: "sports_update_comment_likes",
        idField: "sports_update_id",
      };
}

function mapDiscoverRow(p: any): UnifiedPost {
  return {
    id: p.id,
    source: "discover",
    user_id: p.user_id,
    first_name: p.profiles?.first_name ?? "Student",
    avatar_url: p.profiles?.avatar_url ?? null,
    text: p.content,
    description: null,
    image_urls: p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [],
    video_urls: p.video_urls?.length ? p.video_urls : p.video_url ? [p.video_url] : [],
    created_at: p.created_at,
    category: p.category ?? null,
  };
}
function mapSportsRow(s: any): UnifiedPost {
  return {
    id: s.id,
    source: "sports",
    user_id: s.user_id,
    first_name: s.profiles?.first_name ?? "Student",
    avatar_url: s.profiles?.avatar_url ?? null,
    text: s.title,
    description: s.description,
    image_urls: s.image_urls?.length ? s.image_urls : s.image_url ? [s.image_url] : [],
    video_urls: s.video_urls ?? [],
    created_at: s.created_at,
    category: s.category ?? null,
  };
}

export default function DiscoverPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [myFirstName, setMyFirstName] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<DiscoverTab>("For You");

  const [forYouPosts, setForYouPosts] = useState<UnifiedPost[] | null>(null);
  const [forYouLoading, setForYouLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [explorePosts, setExplorePosts] = useState<UnifiedPost[] | null>(null);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UnifiedPost[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
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

      const { data: p } = await supabase
        .from("profiles")
        .select("first_name, avatar_url")
        .eq("id", data.user.id)
        .single();
      setMyFirstName(p?.first_name ?? null);
      setMyAvatarUrl(p?.avatar_url ?? null);

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
        ? supabase
            .from("discover_posts")
            .select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)")
            .in("id", discoverIds)
        : Promise.resolve({ data: [] as any[] }),
      sportsIds.length
        ? supabase
            .from("sports_updates")
            .select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)")
            .in("id", sportsIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const discoverMap = new Map((discoverRes.data ?? []).map((p: any) => [p.id, mapDiscoverRow(p)]));
    const sportsMap = new Map((sportsRes.data ?? []).map((s: any) => [s.id, mapSportsRow(s)]));

    const ordered: UnifiedPost[] = [];
    for (const item of items) {
      const post =
        item.source_type === "discover_post" ? discoverMap.get(item.source_id) : sportsMap.get(item.source_id);
      if (post) ordered.push(post);
    }

    setForYouPosts(ordered);
    setForYouLoading(false);
    await loadEngagementFor(ordered);
  }

  async function loadCategory(category: string) {
    setSelectedCategory(category);
    setSearchResults(null);
    setSearchQuery("");
    setExploreLoading(true);

    const [discoverRes, sportsRes] = await Promise.all([
      supabase
        .from("discover_posts")
        .select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)")
        .eq("category", category)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("sports_updates")
        .select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)")
        .eq("category", category)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const merged = [
      ...(discoverRes.data ?? []).map(mapDiscoverRow),
      ...(sportsRes.data ?? []).map(mapSportsRow),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setExplorePosts(merged);
    setExploreLoading(false);
    await loadEngagementFor(merged);
  }

  async function runSearch() {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setSelectedCategory(null);

    const [discoverRes, sportsRes] = await Promise.all([
      supabase
        .from("discover_posts")
        .select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)")
        .ilike("content", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("sports_updates")
        .select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const merged = [
      ...(discoverRes.data ?? []).map(mapDiscoverRow),
      ...(sportsRes.data ?? []).map(mapSportsRow),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSearchResults(merged);
    setSearching(false);
    await loadEngagementFor(merged);
  }

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
    } else {
      await supabase.from("discover_post_bookmarks").insert({ post_id: post.id, user_id: userId });
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

  function removeFromLists(post: UnifiedPost) {
    setForYouPosts((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
    setExplorePosts((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
    setSearchResults((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
  }

  async function handleDeletePost(post: UnifiedPost) {
    if (!userId) return;
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    const k = keyFor(post.source, post.id);
    setDeletingKey(k);
    const table = post.source === "discover" ? "discover_posts" : "sports_updates";
    const { error } = await supabase.from(table).delete().eq("id", post.id).eq("user_id", userId);

    if (post.source === "discover" && !error) {
      await supabase.from("discover_feed_items").delete().eq("source_type", "discover_post").eq("source_id", post.id);
    }

    setDeletingKey(null);
    setMenuOpenFor(null);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    removeFromLists(post);
  }

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
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                {post.avatar_url ? (
                  <img src={post.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  post.first_name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{post.first_name}</p>
                <p className="text-[11px] text-hub-textDim">
                  {timeAgo(post.created_at)}
                  {post.category ? ` · ${post.category}` : ""}
                </p>
              </div>
            </div>
            <button onClick={() => setMenuOpenFor(menuOpenFor === k ? null : k)} className="shrink-0 text-hub-textDim px-1">
              <MoreIcon />
            </button>
          </div>

          {menuOpenFor === k && (
            <div className="absolute right-0 top-11 z-20 w-48 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
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
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab ? "bg-hub-accentLight text-white" : "text-hub-textDim"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push("/profile")}
          className="mt-4 flex w-full items-center gap-3 rounded-full border border-hub-border bg-hub-card px-3 py-2.5 text-left"
        >
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
            {myAvatarUrl ? (
              <img src={myAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              myFirstName?.charAt(0).toUpperCase() ?? "U"
            )}
          </div>
          <span className="text-sm text-hub-textDim">Share something from your Profile...</span>
        </button>
      </div>

      {activeTab === "For You" && (
        <div className="mt-3">
          {forYouLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}
          {!forYouLoading && forYouPosts && forYouPosts.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-hub-textDim">
              Nothing here yet — post something from your Profile to get started.
            </p>
          )}
          {!forYouLoading && (forYouPosts ?? []).map(renderPostCard)}
        </div>
      )}

      {activeTab === "Following" && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-white/90">You&apos;re not following anyone yet</p>
          <p className="mt-1 text-xs text-hub-textDim">Posts from people you follow will show up here once following is available.</p>
        </div>
      )}

      {activeTab === "Explore" && (
        <div className="mt-3">
          <div className="px-5">
            <div className="flex items-center gap-2 rounded-full border border-hub-border bg-hub-card px-3 py-2">
              <SearchIcon />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                placeholder="Search posts..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults(null);
                  }}
                  className="text-hub-textDim"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {searchResults === null && (
            <div className="mt-4 px-5">
              <div className="grid grid-cols-2 gap-3">
                {EXPLORE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => loadCategory(cat)}
                    className={`rounded-xl border p-4 text-left ${
                      selectedCategory === cat ? "border-hub-accentLight bg-hub-accentLight/10" : "border-hub-border bg-hub-card"
                    }`}
                  >
                    <span className="text-sm font-medium text-white">{cat}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults === null && selectedCategory && (
            <div className="mt-4">
              <p className="px-5 pb-2 text-sm font-medium text-hub-textDim">{selectedCategory}</p>
              {exploreLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}
              {!exploreLoading && explorePosts && explorePosts.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-hub-textDim">No posts in this category yet.</p>
              )}
              {!exploreLoading && (explorePosts ?? []).map(renderPostCard)}
            </div>
          )}

          {searchResults !== null && (
            <div className="mt-4">
              {searching && <p className="px-5 text-center text-sm text-hub-textDim">Searching...</p>}
              {!searching && searchResults.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-hub-textDim">No results for &quot;{searchQuery}&quot;.</p>
              )}
              {!searching && searchResults.map(renderPostCard)}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-hub-textDim">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
