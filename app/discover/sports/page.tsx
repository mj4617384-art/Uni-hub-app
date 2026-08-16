"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  SportsUpdate,
  SportsComment,
  ReactionType,
  ReactionRecord,
  REACTIONS,
  REACTION_TOP,
  REACTION_BOTTOM,
  MAX_MEDIA_PER_TYPE,
  SPORTS_CATEGORY_OPTIONS,
  linkifyContent,
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
  TrophyIcon,
} from "@/lib/discover/shared";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SportsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [updates, setUpdates] = useState<SportsUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [reactionsByUpdate, setReactionsByUpdate] = useState<Record<string, ReactionRecord[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);

  const [commentsByUpdate, setCommentsByUpdate] = useState<Record<string, SportsComment[]>>({});
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const categoryScopeRef = useRef<HTMLDivElement | null>(null);
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
      if (categoryOpen && categoryScopeRef.current && !categoryScopeRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [reactionPickerFor, menuOpenFor, categoryOpen]);

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
      await loadUpdates();
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadUpdates() {
    const { data, error } = await supabase
      .from("sports_updates")
      .select("*, profiles(first_name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Load sports updates failed: " + error.message);
      return;
    }

    const mapped = (data ?? []).map((p: any) => ({
      ...p,
      first_name: p.profiles?.first_name ?? "Student",
    }));
    setUpdates(mapped);

    const ids = mapped.map((p) => p.id);
    if (ids.length > 0) {
      await Promise.all([loadReactions(ids), loadComments(ids)]);
    }
  }

  async function loadReactions(updateIds: string[]) {
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
      grouped[r.sports_update_id].push({
        type: r.type,
        user_id: r.user_id,
        first_name: r.profiles?.first_name ?? "Student",
      });
    });
    setReactionsByUpdate(grouped);
  }

  async function refreshReactionsForUpdate(updateId: string) {
    const { data, error } = await supabase
      .from("sports_update_reactions")
      .select("sports_update_id, user_id, type, profiles(first_name)")
      .eq("sports_update_id", updateId);
    if (error) {
      console.error(error);
      return;
    }
    setReactionsByUpdate((prev) => ({
      ...prev,
      [updateId]: (data ?? []).map((r: any) => ({
        type: r.type,
        user_id: r.user_id,
        first_name: r.profiles?.first_name ?? "Student",
      })),
    }));
  }

  async function loadComments(updateIds: string[]) {
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
    setCommentsByUpdate(grouped);
    if (allIds.length > 0) await loadCommentLikes(allIds);
  }

  async function refreshCommentsForUpdate(updateId: string) {
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
    setCommentsByUpdate((prev) => ({ ...prev, [updateId]: mapped }));
    const ids = mapped.map((c) => c.id);
    if (ids.length > 0) await loadCommentLikes(ids);
  }

  async function loadCommentLikes(commentIds: string[]) {
    const { data, error } = await supabase
      .from("sports_update_comment_likes")
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
        .from("sports_update_comment_likes")
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
        .from("sports_update_comment_likes")
        .insert({ comment_id: commentId, user_id: userId });
      if (error) {
        setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
        alert("Like failed: " + error.message);
      }
    }
  }

  function addImages(files: File[]) {
    setImageFiles((prev) => [...prev, ...files].slice(0, MAX_MEDIA_PER_TYPE));
  }
  function addVideos(files: File[]) {
    setVideoFiles((prev) => [...prev, ...files].slice(0, MAX_MEDIA_PER_TYPE));
  }
  function removeImage(i: number) {
    setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
  }
  function removeVideo(i: number) {
    setVideoFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handlePost() {
    if (!userId || !title.trim()) return;
    setPosting(true);
    setUploadError(null);

    const image_urls: string[] = [];
    const video_urls: string[] = [];

    for (const file of imageFiles) {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("sports-images").upload(path, file);
      if (upErr) {
        setUploadError("Image upload failed: " + upErr.message);
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("sports-images").getPublicUrl(path);
      image_urls.push(urlData.publicUrl);
    }
    for (const file of videoFiles) {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("sports-videos").upload(path, file);
      if (upErr) {
        setUploadError("Video upload failed: " + upErr.message);
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("sports-videos").getPublicUrl(path);
      video_urls.push(urlData.publicUrl);
    }

    const { data: inserted, error } = await supabase
      .from("sports_updates")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || "General",
        image_url: image_urls[0] ?? null,
        image_urls,
        video_urls,
      })
      .select("id, created_at")
      .single();

    if (error) {
      setUploadError("Post failed: " + error.message);
      setPosting(false);
      return;
    }

    // Keep the unified feed index in sync — this is what lets Sports posts
    // surface into the merged For You feed later.
    if (inserted) {
      const { error: feedErr } = await supabase.from("discover_feed_items").insert({
        source_type: "sports_update",
        source_id: inserted.id,
        user_id: userId,
        category: "sports",
        visibility: "public",
        created_at: inserted.created_at,
      });
      if (feedErr) console.error("Feed index insert failed:", feedErr);
    }

    setTitle("");
    setDescription("");
    setCategory("");
    setImageFiles([]);
    setVideoFiles([]);
    await loadUpdates();
    setPosting(false);
  }

  async function handleDeleteUpdate(updateId: string) {
    if (!userId) return;
    if (!window.confirm("Delete this update? This can't be undone.")) return;
    setDeletingId(updateId);
    const { error } = await supabase.from("sports_updates").delete().eq("id", updateId).eq("user_id", userId);
    setDeletingId(null);
    setMenuOpenFor(null);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    setUpdates((prev) => prev.filter((p) => p.id !== updateId));
  }

  async function pickReaction(updateId: string, type: ReactionType) {
    if (!userId) return;
    setReactingId(updateId);
    const existing = (reactionsByUpdate[updateId] || []).find((r) => r.user_id === userId);
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
    await refreshReactionsForUpdate(updateId);
    setReactingId(null);
    setReactionPickerFor(null);
  }

  function toggleReactionButton(updateId: string) {
    setReactionPickerFor((prev) => (prev === updateId ? null : updateId));
  }

  function startReply(updateId: string, commentId: string, name: string) {
    setReplyTo((prev) => ({ ...prev, [updateId]: { commentId, name } }));
    setCommentOpenFor(updateId);
    setTimeout(() => commentInputRefs.current[updateId]?.focus(), 0);
  }
  function cancelReply(updateId: string) {
    setReplyTo((prev) => ({ ...prev, [updateId]: null }));
  }

  async function submitComment(updateId: string) {
    if (!userId) return;
    const text = (commentDraft[updateId] || "").trim();
    if (!text) return;
    setCommentPosting(updateId);
    const parentId = replyTo[updateId]?.commentId ?? null;
    const { error } = await supabase
      .from("sports_update_comments")
      .insert({ sports_update_id: updateId, user_id: userId, parent_id: parentId, content: text });
    setCommentPosting(null);
    if (error) {
      alert("Comment failed: " + error.message);
      return;
    }
    setCommentDraft((prev) => ({ ...prev, [updateId]: "" }));
    setReplyTo((prev) => ({ ...prev, [updateId]: null }));
    await refreshCommentsForUpdate(updateId);
  }

  function toggleBookmark(id: string) {
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function shareUpdate(update: SportsUpdate) {
    const url = `${window.location.origin}/discover/sports?update=${update.id}`;
    const text = update.title || "Check out this sports update on Uni.hub";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Uni.hub Sports", text, url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
    setMenuOpenFor(null);
  }

  async function copyLink(update: SportsUpdate) {
    const url = `${window.location.origin}/discover/sports?update=${update.id}`;
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard");
    setMenuOpenFor(null);
  }

  function setInterest(updateId: string, val: "interested" | "not_interested") {
    setInterestState((prev) => ({ ...prev, [updateId]: prev[updateId] === val ? null : val }));
    setMenuOpenFor(null);
  }
  function toggleNotify(updateId: string) {
    setNotifyOn((prev) => ({ ...prev, [updateId]: !prev[updateId] }));
    setMenuOpenFor(null);
  }
  function hideUpdate(updateId: string) {
    setUpdates((prev) => prev.filter((p) => p.id !== updateId));
    setMenuOpenFor(null);
  }
  function reportUpdate() {
    alert("Update reported. Our team will review it.");
    setMenuOpenFor(null);
  }

  const filteredCategoryOptions = SPORTS_CATEGORY_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(category.toLowerCase())
  );

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
        <div className="flex items-center gap-2">
          <TrophyIcon small />
          <span className="text-xs font-medium text-hub-textDim">Post a sports update</span>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. UNILAG vs UI final score"
          className="mt-2 w-full bg-transparent text-sm font-medium text-white placeholder:text-hub-textDim outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add more details..."
          rows={2}
          className="mt-1 w-full resize-none bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
        />

        <div ref={categoryScopeRef} className="relative mt-2">
          <div className="flex items-center gap-2 rounded-lg border border-hub-border bg-hub-card2 px-3 py-1.5">
            <input
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCategoryOpen(true);
              }}
              onFocus={() => setCategoryOpen(true)}
              placeholder="Category — e.g. Football"
              className="flex-1 bg-transparent text-xs text-white placeholder:text-hub-textDim outline-none"
            />
            <button type="button" onClick={() => setCategoryOpen((v) => !v)} className="shrink-0 text-hub-textDim">
              <ChevronIcon open={categoryOpen} />
            </button>
          </div>
          {categoryOpen && filteredCategoryOptions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
              {filteredCategoryOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setCategory(opt);
                    setCategoryOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-white"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
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
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageFiles.length >= MAX_MEDIA_PER_TYPE}
              className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim disabled:opacity-40"
            >
              <PhotoIcon />
              <span>Photo {imageFiles.length > 0 ? `(${imageFiles.length}/5)` : ""}</span>
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={videoFiles.length >= MAX_MEDIA_PER_TYPE}
              className="flex shrink-0 items-center gap-1.5 text-xs text-hub-textDim disabled:opacity-40"
            >
              <VideoIcon />
              <span>Video {videoFiles.length > 0 ? `(${videoFiles.length}/5)` : ""}</span>
            </button>
          </div>
          <button
            onClick={handlePost}
            disabled={posting || !title.trim()}
            className="shrink-0 rounded-lg bg-hub-accentLight px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {updates.length === 0 && (
          <p className="px-5 text-center text-sm text-hub-textDim">
            No sports updates yet — be the first to share one!
          </p>
        )}

        {updates.map((update) => {
          const updateReactions = reactionsByUpdate[update.id] || [];
          const myReaction = updateReactions.find((r) => r.user_id === userId)?.type ?? null;
          const activeReactionInfo = REACTIONS.find((r) => r.type === myReaction);
          const summaryText = reactionSummaryText(updateReactions, userId);
          const allComments = commentsByUpdate[update.id] || [];
          const topLevel = allComments.filter((c) => !c.parent_id);
          const repliesOf = (id: string) => allComments.filter((c) => c.parent_id === id);
          const isMine = update.user_id === userId;
          const currentReply = replyTo[update.id];
          const images = update.image_urls && update.image_urls.length > 0 ? update.image_urls : update.image_url ? [update.image_url] : [];
          const videos = update.video_urls && update.video_urls.length > 0 ? update.video_urls : [];

          return (
            <div key={update.id} className="relative border-b border-hub-border bg-hub-card px-4 py-3">
              <div ref={(el) => { menuScopeRefs.current[update.id] = el; }} className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                      {update.first_name?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{update.first_name}</p>
                      <p className="text-xs text-hub-textDim">
                        {timeAgo(update.created_at)} ·{" "}
                        <span className="text-hub-accentLight">{update.category}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMenuOpenFor(menuOpenFor === update.id ? null : update.id)}
                    className="shrink-0 text-hub-textDim px-1"
                  >
                    <MoreIcon />
                  </button>
                </div>

                {menuOpenFor === update.id && (
                  <div className="absolute right-0 top-12 z-20 w-56 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
                    <button onClick={() => setInterest(update.id, "interested")} className="flex w-full items-start gap-3 px-3 py-2 text-left">
                      <PlusCircleIcon />
                      <span>
                        <span className="block text-xs font-medium text-white">
                          {interestState[update.id] === "interested" ? "Marked Interested" : "Interested"}
                        </span>
                        <span className="block text-[10px] text-hub-textDim">More updates like this</span>
                      </span>
                    </button>
                    <button onClick={() => setInterest(update.id, "not_interested")} className="flex w-full items-start gap-3 px-3 py-2 text-left">
                      <MinusCircleIcon />
                      <span>
                        <span className="block text-xs font-medium text-white">
                          {interestState[update.id] === "not_interested" ? "Marked Not interested" : "Not interested"}
                        </span>
                        <span className="block text-[10px] text-hub-textDim">Fewer updates like this</span>
                      </span>
                    </button>
                    <div className="my-1 border-t border-hub-border" />
                    <button onClick={() => toggleBookmark(update.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <BookmarkIcon filled={!!bookmarked[update.id]} />
                      {bookmarked[update.id] ? "Saved" : "Save post"}
                    </button>
                    <button onClick={() => shareUpdate(update)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <ShareIcon />
                      Share
                    </button>
                    <button onClick={() => hideUpdate(update.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <EyeOffIcon />
                      I don&apos;t want to see this
                    </button>
                    <button onClick={reportUpdate} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <FlagIcon />
                      Report post
                    </button>
                    <button onClick={() => toggleNotify(update.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <BellSmallIcon />
                      {notifyOn[update.id] ? "Turn off notifications" : "Turn on notifications"}
                    </button>
                    <button onClick={() => copyLink(update)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-white">
                      <LinkIcon />
                      Copy link
                    </button>
                    {isMine && (
                      <>
                        <div className="my-1 border-t border-hub-border" />
                        <button
                          onClick={() => handleDeleteUpdate(update.id)}
                          disabled={deletingId === update.id}
                          className="block w-full px-3 py-2 text-left text-xs text-red-400 disabled:opacity-40"
                        >
                          {deletingId === update.id ? "Deleting..." : "Delete post"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm font-semibold text-white">{update.title}</p>
              {update.description && (
                <p className="mt-1 text-sm text-white/90 whitespace-pre-wrap">{linkifyContent(update.description)}</p>
              )}

              <MediaCarousel images={images} videos={videos} registerVideoRef={registerVideoRef} />

              {summaryText && <p className="mt-3 text-xs text-hub-textDim">{summaryText}</p>}

              <div ref={(el) => { reactionScopeRefs.current[update.id] = el; }} className="relative mt-2 flex items-center justify-between border-t border-hub-border pt-3">
                {reactionPickerFor === update.id && (
                  <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-hub-border bg-hub-card2 px-4 py-3 shadow-xl">
                    <div className="flex items-start gap-4">
                      {REACTION_TOP.map((r) => (
                        <button
                          key={r.type}
                          onClick={() => pickReaction(update.id, r.type)}
                          disabled={reactingId === update.id}
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
                          onClick={() => pickReaction(update.id, r.type)}
                          disabled={reactingId === update.id}
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
                    onClick={() => toggleReactionButton(update.id)}
                    className={`flex items-center gap-1.5 text-xs ${activeReactionInfo ? "text-hub-accentLight" : "text-hub-textDim"}`}
                  >
                    {activeReactionInfo ? (
                      activeReactionInfo.type === "like" ? (
                        <ThumbsUpIcon className="text-hub-accentLight" filled />
                      ) : (
                        <span className="text-base leading-none">{activeReactionInfo.emoji}</span>
                      )
                    ) : (
                      <ThumbsUpIcon className="text-hub-textDim" />
                    )}
                    {updateReactions.length > 0 && <span>{updateReactions.length}</span>}
                  </button>
                  <button
                    onClick={() => setCommentOpenFor(commentOpenFor === update.id ? null : update.id)}
                    className="flex items-center gap-1.5 text-xs text-hub-textDim"
                  >
                    <CommentIcon />
                    {allComments.length > 0 && <span>{allComments.length}</span>}
                  </button>
                  <button onClick={() => shareUpdate(update)} className="flex items-center gap-1.5 text-xs text-hub-textDim">
                    <ShareIcon />
                  </button>
                </div>
                <button
                  onClick={() => toggleBookmark(update.id)}
                  className={`shrink-0 ${bookmarked[update.id] ? "text-hub-accentLight" : "text-hub-textDim"}`}
                >
                  <BookmarkIcon filled={!!bookmarked[update.id]} />
                </button>
              </div>

              {commentOpenFor === update.id && (
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
                          onReply={() => startReply(update.id, c.id, c.first_name || "them")}
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
                                onReply={() => startReply(update.id, c.id, c.first_name || "them")}
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
                      <button onClick={() => cancelReply(update.id)} className="text-hub-accentLight">Cancel</button>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={(el) => { commentInputRefs.current[update.id] = el; }}
                      value={commentDraft[update.id] || ""}
                      onChange={(e) => setCommentDraft((prev) => ({ ...prev, [update.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitComment(update.id);
                      }}
                      placeholder={currentReply ? `Reply to ${currentReply.name}...` : "Write a comment..."}
                      className="flex-1 rounded-full border border-hub-border bg-hub-card2 px-3 py-1.5 text-xs text-white placeholder:text-hub-textDim outline-none"
                    />
                    <button
                      onClick={() => submitComment(update.id)}
                      disabled={commentPosting === update.id || !(commentDraft[update.id] || "").trim()}
                      className="shrink-0 text-xs font-medium text-hub-accentLight disabled:opacity-40"
                    >
                      {commentPosting === update.id ? "..." : "Send"}
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
