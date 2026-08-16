"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Post,
  ReactionType,
  ReactionRecord,
  Comment,
  REACTIONS,
  REACTION_TOP,
  REACTION_BOTTOM,
  MAX_MEDIA_PER_TYPE,
  linkifyContent,
  extractHashtags,
  timeAgo,
  reactionSummaryText,
  MediaCarousel,
  MediaPicker,
  CommentRow,
  PhotoIcon,
  VideoIcon,
  MoreIcon,
  ThumbsUpIcon,
  CommentIcon,
  BookmarkIcon,
  ShareIcon,
  EyeOffIcon,
  FlagIcon,
  BellSmallIcon,
  LinkIcon,
  PlusCircleIcon,
  MinusCircleIcon,
} from "@/lib/discover/shared";

export default function ForYouPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

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
    if (error) { console.error(error); return; }
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
    if (error) { console.error(error); return; }
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
    if (error) { console.error(error); return; }
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
    if (error) { console.error(error); return; }
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
    if (error) { console.error(error); return; }
    setCommentLikes((prev) => {
      const next = { ...prev };
      commentIds.forEach((id) => { next[id] = { count: 0, mine: false }; });
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
      const { error } = await supabase.from("discover_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
      if (error) { setCommentLikes((prev) => ({ ...prev, [commentId]: current })); alert("Unlike failed: " + error.message); }
    } else {
      setCommentLikes((prev) => ({ ...prev, [commentId]: { count: current.count + 1, mine: true } }));
      const { error } = await supabase.from("discover_comment_likes").insert({ comment_id: commentId, user_id: userId });
      if (error) { setCommentLikes((prev) => ({ ...prev, [commentId]: current })); alert("Like failed: " + error.message); }
    }
  }

  function addImages(files: File[]) { setImageFiles((prev) => [...prev, ...files].slice(0, MAX_MEDIA_PER_TYPE)); }
  function addVideos(files: File[]) { setVideoFiles((prev) => [...prev, ...files].slice(0, MAX_MEDIA_PER_TYPE)); }
  function removeImage(i: number) { setImageFiles((prev) => prev.filter((_, idx) => idx !== i)); }
  function removeVideo(i: number) { setVideoFiles((prev) => prev.filter((_, idx) => idx !== i)); }

  async function handlePost() {
    if (!userId || (!content.trim() && imageFiles.length === 0 && videoFiles.length === 0)) return;
    setPosting(true);
    setUploadError(null);

    const image_urls: string[] = [];
    const video_urls: string[] = [];

    for (const file of imageFiles) {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("discover-images").upload(path, file);
      if (upErr) { setUploadError("Image upload failed: " + upErr.message); setPosting(false); return; }
      const { data: urlData } = supabase.storage.from("discover-images").getPublicUrl(path);
      image_urls.push(urlData.publicUrl);
    }
    for (const file of videoFiles) {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("discover-videos").upload(path, file);
      if (upErr) { setUploadError("Video upload failed: " + upErr.message); setPosting(false); return; }
      const { data: urlData } = supabase.storage.from("discover-videos").getPublicUrl(path);
      video_urls.push(urlData.publicUrl);
    }

    const hashtags = extractHashtags(content);

    const { data: inserted, error } = await supabase
      .from("discover_posts")
      .insert({
        user_id: userId,
        content: content.trim() || null,
        image_url: image_urls[0] ?? null,
        video_url: video_urls[0] ?? null,
        image_urls,
        video_urls,
        hashtags,
      })
      .select("id, category, visibility, created_at")
      .single();

    if (error) { setUploadError("Post failed: " + error.message); setPosting(false); return; }

    // Keep the unified feed index in sync so this post is discoverable
    // through the same system Sports/News/etc. write into.
    if (inserted) {
      const { error: feedErr } = await supabase.from("discover_feed_items").insert({
        source_type: "discover_post",
        source_id: inserted.id,
        user_id: userId,
        category: inserted.category ?? "campus_life",
        visibility: inserted.visibility ?? "public",
        created_at: inserted.created_at,
      });
      if (feedErr) console.error("Feed index insert failed:", feedErr);
    }

    setContent(""); setImageFiles([]); setVideoFiles([]);
    await loadPosts();
    setPosting(false);
  }

  async function handleDeletePost(postId: string) {
    if (!userId) return;
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setDeletingId(postId);
    const { error } = await supabase.from("discover_posts").delete().eq("id", postId).eq("user_id", userId);
    setDeletingId(null); setMenuOpenFor(null);
    if (error) { alert("Delete failed: " + error.message); return; }
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
      const { error } = await supabase.from("discover_reactions").upsert({ post_id: postId, user_id: userId, type }, { onConflict: "post_id,user_id" });
      if (error) alert("Reaction failed: " + error.message);
    }
    await refreshReactionsForPost(postId);
    setReactingId(null); setReactionPickerFor(null);
  }

  function toggleReactionButton(postId: string) { setReactionPickerFor((prev) => (prev === postId ? null : postId)); }

  function startReply(postId: string, commentId: string, name: string) {
    setReplyTo((prev) => ({ ...prev, [postId]: { commentId, name } }));
    setCommentOpenFor(postId);
    setTimeout(() => commentInputRefs.current[postId]?.focus(), 0);
  }
  function cancelReply(postId: string) { setReplyTo((prev) => ({ ...prev, [postId]: null })); }

  async function submitComment(postId: string) {
    if (!userId) return;
    const text = (commentDraft[postId] || "").trim();
    if (!text) return;
    setCommentPosting(postId);
    const parentId = replyTo[postId]?.commentId ?? null;
    const { error } = await supabase.from("discover_comments").insert({ post_id: postId, user_id: userId, parent_id: parentId, content: text });
    setCommentPosting(null);
    if (error) { alert("Comment failed: " + error.message); return; }
    setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
    setReplyTo((prev) => ({ ...prev, [postId]: null }));
    await refreshCommentsForPost(postId);
  }

  function toggleBookmark(id: string) { setBookmarked((prev) => ({ ...prev, [id]: !prev[id] })); }

  async function sharePost(post: Post) {
    const url = `${window.location.origin}/discover?post=${post.id}`;
    const text = post.content?.slice(0, 100) || "Check out this post on Uni.hub";
    if (navigator.share) { try { await navigator.share({ title: "Uni.hub", text, url }); } catch {} }
    else { await navigator.clipboard.writeText(url); alert("Link copied to clipboard"); }
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
  function toggleNotify(postId: string) { setNotifyOn((prev) => ({ ...prev, [postId]: !prev[postId] })); setMenuOpenFor(null); }
  function hidePost(postId: string) { setPosts((prev) => prev.filter((p) => p.id !== postId)); setMenuOpenFor(null); }
  function reportPost() { alert("Post reported. Our team will review it."); setMenuOpenFor(null); }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <>
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

        <MediaPicker
          images={imageFiles}
          videos={videoFiles}
          onAddImages={addImages}
          onAddVideos={addVideos}
          onRemoveImage={removeImage}
          onRemoveVideo={removeVideo}
          imageInputRef={imageInputRef}
          videoInputRef={videoInputRef}
        />
        {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}

        <div className="mt-3 flex items-center justify-between border-t border-hub-border pt-3">
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={imageFiles.length >= MAX_MEDIA_PER_TYPE} className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim disabled:opacity-40">
              <PhotoIcon /><span>Photo {imageFiles.length > 0 ? `(${imageFiles.length}/5)` : ""}</span>
            </button>
            <button type="button" onClick={() => videoInputRef.current?.click()} disabled={videoFiles.length >= MAX_MEDIA_PER_TYPE} className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim disabled:opacity-40">
              <VideoIcon /><span>Video {videoFiles.length > 0 ? `(${videoFiles.length}/5)` : ""}</span>
            </button>
          </div>
          <button
            onClick={handlePost}
            disabled={posting || (!content.trim() && imageFiles.length === 0 && videoFiles.length === 0)}
            className="shrink-0 rounded-lg bg-hub-accentLight px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {posts.length === 0 && <p className="px-5 text-center text-sm text-hub-textDim">No posts yet — be the first to share something!</p>}

        {posts.map((post) => {
          const postReactions = reactionsByPost[post.id] || [];
          const myReaction = postReactions.find((r) => r.user_id === userId)?.type ?? null;
          const activeReactionInfo = REACTIONS.find((r) => r.type === myReaction);
          const summaryText = reactionSummaryText(postReactions, userId);
          const allComments = commentsByPost[post.id] || [];
          const topLevel = allComments.filter((c) => !c.parent_id);
          const repliesOf = (id: string) => allComments.filter((c) => c.parent_id === id);
          const isMine = post.user_id === userId;
          const currentReply = replyTo[post.id];
          const images = post.image_urls && post.image_urls.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
          const videos = post.video_urls && post.video_urls.length > 0 ? post.video_urls : post.video_url ? [post.video_url] : [];

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
                      <p className="text-xs text-hub-textDim">{timeAgo(post.created_at)}{post.department ? ` · ${post.department}` : ""}</p>
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

              {post.content && <p className="mt-3 text-sm text-white/90 whitespace-pre-wrap">{linkifyContent(post.content)}</p>}

              <MediaCarousel images={images} videos={videos} registerVideoRef={registerVideoRef} />

              {summaryText && <p className="mt-3 text-xs text-hub-textDim">{summaryText}</p>}

              <div ref={(el) => { reactionScopeRefs.current[post.id] = el; }} className="relative mt-2 flex items-center justify-between border-t border-hub-border pt-3">
                {reactionPickerFor === post.id && (
                  <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-hub-border bg-hub-card2 px-4 py-3 shadow-xl">
                    <div className="flex items-start gap-4">
                      {REACTION_TOP.map((r) => (
                        <button key={r.type} onClick={() => pickReaction(post.id, r.type)} disabled={reactingId === post.id} className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}>
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>
                            {r.type === "like" ? <ThumbsUpIcon className="text-white" filled /> : <span className="text-lg leading-none">{r.emoji}</span>}
                          </span>
                          <span className="text-[10px] text-hub-textDim">{r.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-start gap-4">
                      {REACTION_BOTTOM.map((r) => (
                        <button key={r.type} onClick={() => pickReaction(post.id, r.type)} disabled={reactingId === post.id} className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}>
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
                  <button onClick={() => toggleReactionButton(post.id)} className={`flex items-center gap-1.5 text-xs ${activeReactionInfo ? "text-hub-accentLight" : "text-hub-textDim"}`}>
                    {activeReactionInfo ? (activeReactionInfo.type === "like" ? <ThumbsUpIcon className="text-hub-accentLight" filled /> : <span className="text-base leading-none">{activeReactionInfo.emoji}</span>) : <ThumbsUpIcon className="text-hub-textDim" />}
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
                        <CommentRow comment={c} liked={!!commentLikes[c.id]?.mine} likeCount={commentLikes[c.id]?.count ?? 0} onLike={() => toggleCommentLike(c.id)} onReply={() => startReply(post.id, c.id, c.first_name || "them")} />
                        {repliesOf(c.id).length > 0 && (
                          <div className="ml-8 mt-2 flex flex-col gap-2">
                            {repliesOf(c.id).map((r) => (
                              <CommentRow key={r.id} comment={r} liked={!!commentLikes[r.id]?.mine} likeCount={commentLikes[r.id]?.count ?? 0} onLike={() => toggleCommentLike(r.id)} onReply={() => startReply(post.id, c.id, c.first_name || "them")} />
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
                    <button onClick={() => submitComment(post.id)} disabled={commentPosting === post.id || !(commentDraft[post.id] || "").trim()} className="shrink-0 text-xs font-medium text-hub-accentLight disabled:opacity-40">
                      {commentPosting === post.id ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
