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

type ExternalItem = {
  id: string;
  title: string | null;
  subject?: string | null;
  price?: number | null;
  image_urls?: string[] | null;
  event_date?: string | null;
  event_time?: string | null;
  location?: string | null;
};

type Person = {
  id: string;
  first_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type PulseItem = {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
};

type PulseGroup = {
  user_id: string;
  first_name: string;
  avatar_url: string | null;
  items: PulseItem[];
  hasUnviewed: boolean;
  isMine: boolean;
};

type PulseViewer = { id: string; first_name: string; avatar_url: string | null; viewed_at: string };

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

const EXTERNAL_CATEGORY_TABLES: Record<string, { table: string; route: string; select: string; orderBy: string; ascending: boolean }> = {
  Marketplace: { table: "marketplace_items", route: "/marketplace", select: "id, title, price, image_urls, created_at", orderBy: "created_at", ascending: false },
  Events: { table: "events", route: "/events", select: "id, title, event_date, event_time, location, created_at", orderBy: "event_date", ascending: true },
  Study: { table: "study_resources", route: "/study-hub", select: "id, title, subject, category, created_at", orderBy: "created_at", ascending: false },
};

const discoverTabs = ["For You", "Following", "Explore"] as const;
type DiscoverTab = (typeof discoverTabs)[number];

const followingSubTabs = ["People", "Posts", "Pulse"] as const;
type FollowingSubTab = (typeof followingSubTabs)[number];

const PEOPLE_PAGE_SIZE = 10;
const PULSE_ITEM_DURATION_MS = 5000;
const TEXT_PULSE_COLORS = ["#2F6FED", "#E1306C", "#25D366", "#7C3AED", "#F59E0B", "#0EA5E9", "#111827"];
const PULSE_REACTIONS = ["❤️", "😂", "👏", "🔥", "👍"];

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
  const [myFirstName, setMyFirstName] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<DiscoverTab>("For You");
  const [followingSubTab, setFollowingSubTab] = useState<FollowingSubTab>("People");

  const [forYouPosts, setForYouPosts] = useState<UnifiedPost[] | null>(null);
  const [forYouLoading, setForYouLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [explorePosts, setExplorePosts] = useState<UnifiedPost[] | null>(null);
  const [exploreExternal, setExploreExternal] = useState<ExternalItem[] | null>(null);
  const [exploreExternalError, setExploreExternalError] = useState<string | null>(null);
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

  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());
  const [followedProfiles, setFollowedProfiles] = useState<Person[]>([]);
  const [followingFeed, setFollowingFeed] = useState<UnifiedPost[] | null>(null);
  const [followingFeedLoading, setFollowingFeedLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleOffset, setPeopleOffset] = useState(0);
  const [peopleHasMore, setPeopleHasMore] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [messageBusyId, setMessageBusyId] = useState<string | null>(null);

  // --- Pulse state ---
  const [pulsesLoaded, setPulsesLoaded] = useState(false);
  const [pulseGroups, setPulseGroups] = useState<PulseGroup[]>([]);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [uploadingPulse, setUploadingPulse] = useState(false);
  const pulseFileInputRef = useRef<HTMLInputElement>(null);
  const pulseCameraInputRef = useRef<HTMLInputElement>(null);

  const [addPulseOpen, setAddPulseOpen] = useState(false);
  const [textPulseOpen, setTextPulseOpen] = useState(false);
  const [textPulseDraft, setTextPulseDraft] = useState("");
  const [textPulseColor, setTextPulseColor] = useState("#2F6FED");

  const [mediaComposerFile, setMediaComposerFile] = useState<File | null>(null);
  const [mediaComposerPreview, setMediaComposerPreview] = useState<string | null>(null);
  const [mediaComposerCaption, setMediaComposerCaption] = useState("");

  const [voicePulseOpen, setVoicePulseOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [pendingPulse, setPendingPulse] = useState<null | { kind: "media" | "text" | "voice" }>(null);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [shareSuccessOpen, setShareSuccessOpen] = useState(false);

  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pulsePrivacy, setPulsePrivacy] = useState("everyone");
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
  const [viewerItemIndex, setViewerItemIndex] = useState(0);
  const [viewerProgress, setViewerProgress] = useState(0);
  const [viewerPaused, setViewerPaused] = useState(false);
  const [viewerReplyDraft, setViewerReplyDraft] = useState("");
  const viewerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [myPulseViewersOpen, setMyPulseViewersOpen] = useState(false);
  const [myPulseViewers, setMyPulseViewers] = useState<PulseViewer[]>([]);
  const [deletePulseTarget, setDeletePulseTarget] = useState<PulseItem | null>(null);

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
        .select("first_name, avatar_url, pulse_privacy")
        .eq("id", data.user.id)
        .single();
      setMyFirstName(p?.first_name ?? null);
      setMyAvatarUrl(p?.avatar_url ?? null);
      setPulsePrivacy(p?.pulse_privacy || "everyone");

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

  useEffect(() => {
    if (activeTab === "Following" && userId && !followingLoaded) loadFollowData();
  }, [activeTab, userId, followingLoaded]);

  useEffect(() => {
    if (activeTab === "Following" && followingSubTab === "Pulse" && userId && followingLoaded && !pulsesLoaded) loadPulses();
  }, [activeTab, followingSubTab, userId, followingLoaded, pulsesLoaded]);

  useEffect(() => {
    if (!viewerOpen || viewerPaused) {
      if (viewerTimerRef.current) clearInterval(viewerTimerRef.current);
      return;
    }
    setViewerProgress(0);
    const startedAt = Date.now();
    viewerTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / PULSE_ITEM_DURATION_MS) * 100);
      setViewerProgress(pct);
      if (pct >= 100) goNextItem();
    }, 50);
    return () => {
      if (viewerTimerRef.current) clearInterval(viewerTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, viewerGroupIndex, viewerItemIndex, viewerPaused]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

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

  async function loadFollowData() {
    if (!userId) return;
    setFollowingLoaded(true);

    const [{ data: myFollows }, { data: myFollowers }] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("following_id", userId),
    ]);

    const followingSet = new Set((myFollows ?? []).map((r: any) => r.following_id));
    const followerSet = new Set((myFollowers ?? []).map((r: any) => r.follower_id));
    setFollowingIds(followingSet);
    setFollowerIds(followerSet);

    await Promise.all([loadPeople(true), loadFollowedProfiles(followingSet)]);
    if (followingSet.size > 0) await loadFollowingFeed(followingSet);
    else setFollowingFeed([]);
  }

  async function loadFollowedProfiles(ids: Set<string>) {
    if (ids.size === 0) {
      setFollowedProfiles([]);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("id, first_name, avatar_url, bio").in("id", Array.from(ids));
    if (error) {
      console.error(error);
      return;
    }
    setFollowedProfiles(data ?? []);
  }

  async function loadFollowingFeed(ids: Set<string>) {
    setFollowingFeedLoading(true);
    const idList = Array.from(ids);
    const [discoverRes, sportsRes] = await Promise.all([
      supabase.from("discover_posts").select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").in("user_id", idList).order("created_at", { ascending: false }).limit(30),
      supabase.from("sports_updates").select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").in("user_id", idList).order("created_at", { ascending: false }).limit(30),
    ]);

    const merged = [...(discoverRes.data ?? []).map(mapDiscoverRow), ...(sportsRes.data ?? []).map(mapSportsRow)].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setFollowingFeed(merged);
    setFollowingFeedLoading(false);
    await loadEngagementFor(merged);
  }

  async function loadPeople(reset = false) {
    if (!userId) return;
    setPeopleLoading(true);
    const offset = reset ? 0 : peopleOffset;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, avatar_url, bio")
      .neq("id", userId)
      .order("first_name", { ascending: true })
      .range(offset, offset + PEOPLE_PAGE_SIZE - 1);

    if (error) {
      console.error(error);
      setPeopleLoading(false);
      return;
    }

    const rows = data ?? [];
    setPeople((prev) => (reset ? rows : [...prev, ...rows]));
    setPeopleOffset(offset + rows.length);
    setPeopleHasMore(rows.length === PEOPLE_PAGE_SIZE);
    setPeopleLoading(false);
  }

  async function toggleFollow(personId: string) {
    if (!userId) return;
    setFollowBusyId(personId);
    const isFollowing = followingIds.has(personId);

    if (isFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", personId);
      if (!error) {
        const next = new Set(followingIds);
        next.delete(personId);
        setFollowingIds(next);
        await Promise.all([loadFollowingFeed(next), loadFollowedProfiles(next)]);
      }
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: personId });
      if (!error) {
        const next = new Set(followingIds);
        next.add(personId);
        setFollowingIds(next);
        await Promise.all([loadFollowingFeed(next), loadFollowedProfiles(next)]);
      }
    }
    setFollowBusyId(null);
  }

  async function handleMessage(personId: string) {
    setMessageBusyId(personId);
    const { data, error } = await supabase.rpc("start_conversation", { other_user_id: personId });
    setMessageBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    router.push(`/messages/${data}`);
  }

  // --- Pulse core ---
  async function loadPulses() {
    if (!userId) return;
    setPulseLoading(true);
    setPulsesLoaded(true);

    const ids = [userId, ...Array.from(followingIds)];
    const { data: pulseRows, error } = await supabase
      .from("pulses")
      .select("id, user_id, media_url, media_type, caption, created_at, profiles(first_name, avatar_url)")
      .in("user_id", ids)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setPulseLoading(false);
      return;
    }

    const rows = pulseRows ?? [];
    const pulseIds = rows.map((r: any) => r.id);

    let viewedSet = new Set<string>();
    if (pulseIds.length > 0) {
      const { data: views } = await supabase.from("pulse_views").select("pulse_id").eq("viewer_id", userId).in("pulse_id", pulseIds);
      viewedSet = new Set((views ?? []).map((v: any) => v.pulse_id));
    }

    const grouped = new Map<string, PulseGroup>();
    for (const row of rows as any[]) {
      const uid = row.user_id;
      if (!grouped.has(uid)) {
        grouped.set(uid, {
          user_id: uid,
          first_name: row.profiles?.first_name ?? "Student",
          avatar_url: row.profiles?.avatar_url ?? null,
          items: [],
          hasUnviewed: false,
          isMine: uid === userId,
        });
      }
      const group = grouped.get(uid)!;
      group.items.push({ id: row.id, media_url: row.media_url, media_type: row.media_type, caption: row.caption, created_at: row.created_at });
      if (!viewedSet.has(row.id)) group.hasUnviewed = true;
    }

    const groupsArr = Array.from(grouped.values());
    const mine = groupsArr.filter((g) => g.isMine);
    const others = groupsArr.filter((g) => !g.isMine).sort((a, b) => (a.hasUnviewed === b.hasUnviewed ? 0 : a.hasUnviewed ? -1 : 1));

    setPulseGroups([...mine, ...others]);
    setPulseLoading(false);
  }

  function openMediaComposer(file: File) {
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("That file is too large (max 25MB). Try a shorter video or a photo instead.");
      return;
    }
    setMediaComposerFile(file);
    setMediaComposerPreview(URL.createObjectURL(file));
    setMediaComposerCaption("");
  }

  function requestShare(kind: "media" | "text" | "voice") {
    setPendingPulse({ kind });
    setShareConfirmOpen(true);
  }

  async function confirmShare() {
    if (!pendingPulse) return;
    setShareConfirmOpen(false);
    if (pendingPulse.kind === "media") await doUploadMedia();
    else if (pendingPulse.kind === "text") await doPostText();
    else if (pendingPulse.kind === "voice") await doUploadVoice();
    setPendingPulse(null);
  }

  async function doUploadMedia() {
    if (!userId || !mediaComposerFile) return;
    setUploadingPulse(true);
    const file = mediaComposerFile;
    const mediaType = file.type.startsWith("video") ? "video" : "image";
    const path = `${userId}/${Date.now()}-${file.name}`;

    const timeoutPromise = new Promise<{ error: any }>((resolve) =>
      setTimeout(() => resolve({ error: { message: "Upload timed out — your connection may be too slow right now." } }), 45000)
    );
    const uploadPromise = supabase.storage.from("pulses").upload(path, file).then((res) => ({ error: res.error }));
    const { error: upErr } = await Promise.race([uploadPromise, timeoutPromise]);

    if (upErr) {
      alert("Pulse upload failed: " + upErr.message);
      setUploadingPulse(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("pulses").getPublicUrl(path);
    const { error } = await supabase.from("pulses").insert({
      user_id: userId, media_url: urlData.publicUrl, media_type: mediaType, caption: mediaComposerCaption || null,
    });
    setUploadingPulse(false);
    setMediaComposerFile(null);
    setMediaComposerPreview(null);
    setMediaComposerCaption("");
    if (error) {
      alert("Post failed: " + error.message);
      return;
    }
    setPulsesLoaded(false);
    await loadPulses();
    setShareSuccessOpen(true);
  }

  async function doPostText() {
    if (!userId || !textPulseDraft.trim()) return;
    setUploadingPulse(true);
    const text = textPulseDraft;
    const bgColor = textPulseColor;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><rect width="720" height="1280" fill="${bgColor}"/><text x="50%" y="50%" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .slice(0, 120)}</text></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const path = `${userId}/text-${Date.now()}.svg`;

    const { error: upErr } = await supabase.storage.from("pulses").upload(path, blob, { contentType: "image/svg+xml" });
    if (upErr) {
      alert("Post failed: " + upErr.message);
      setUploadingPulse(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("pulses").getPublicUrl(path);
    const { error } = await supabase.from("pulses").insert({ user_id: userId, media_url: urlData.publicUrl, media_type: "image" });
    setUploadingPulse(false);
    setTextPulseOpen(false);
    setTextPulseDraft("");
    if (error) {
      alert("Post failed: " + error.message);
      return;
    }
    setPulsesLoaded(false);
    await loadPulses();
    setShareSuccessOpen(true);
  }

  async function doUploadVoice() {
    if (!userId || !recordedBlob) return;
    setUploadingPulse(true);
    const fileName = `voice-${Date.now()}.webm`;
    const path = `${userId}/${fileName}`;
    const { error: upErr } = await supabase.storage.from("pulses").upload(path, recordedBlob, { contentType: "audio/webm" });
    if (upErr) {
      alert("Voice pulse upload failed: " + upErr.message);
      setUploadingPulse(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("pulses").getPublicUrl(path);
    const { error } = await supabase.from("pulses").insert({ user_id: userId, media_url: urlData.publicUrl, media_type: "voice" });
    setUploadingPulse(false);
    setVoicePulseOpen(false);
    setRecordedBlob(null);
    setRecordSeconds(0);
    if (error) {
      alert("Post failed: " + error.message);
      return;
    }
    setPulsesLoaded(false);
    await loadPulses();
    setShareSuccessOpen(true);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setRecordedBlob(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Couldn't access your microphone. Check site permissions and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function openViewer(groupIndex: number) {
    setViewerGroupIndex(groupIndex);
    setViewerItemIndex(0);
    setViewerPaused(false);
    setViewerOpen(true);
    markViewed(pulseGroups[groupIndex]?.items[0]?.id);
    if (pulseGroups[groupIndex]?.isMine) loadMyPulseViewers(pulseGroups[groupIndex].items[0]?.id);
  }

  function closeViewer() {
    setViewerOpen(false);
  }

  async function markViewed(pulseId: string | undefined) {
    if (!pulseId || !userId) return;
    await supabase.from("pulse_views").upsert({ pulse_id: pulseId, viewer_id: userId }, { onConflict: "pulse_id,viewer_id" });
  }

  async function loadMyPulseViewers(pulseId: string | undefined) {
    if (!pulseId) return;
    const { data } = await supabase
      .from("pulse_views")
      .select("viewer_id, viewed_at, profiles(first_name, avatar_url)")
      .eq("pulse_id", pulseId)
      .order("viewed_at", { ascending: false });
    setMyPulseViewers(
      (data ?? []).map((v: any) => ({
        id: v.viewer_id,
        first_name: v.profiles?.first_name ?? "Student",
        avatar_url: v.profiles?.avatar_url ?? null,
        viewed_at: v.viewed_at,
      }))
    );
  }

  function goNextItem() {
    const group = pulseGroups[viewerGroupIndex];
    if (!group) return closeViewer();
    if (viewerItemIndex < group.items.length - 1) {
      const nextIndex = viewerItemIndex + 1;
      setViewerItemIndex(nextIndex);
      markViewed(group.items[nextIndex]?.id);
      if (group.isMine) loadMyPulseViewers(group.items[nextIndex]?.id);
    } else if (viewerGroupIndex < pulseGroups.length - 1) {
      const nextGroup = viewerGroupIndex + 1;
      setViewerGroupIndex(nextGroup);
      setViewerItemIndex(0);
      markViewed(pulseGroups[nextGroup]?.items[0]?.id);
      if (pulseGroups[nextGroup]?.isMine) loadMyPulseViewers(pulseGroups[nextGroup].items[0]?.id);
    } else {
      closeViewer();
    }
  }

  function goPrevItem() {
    const group = pulseGroups[viewerGroupIndex];
    if (!group) return;
    if (viewerItemIndex > 0) {
      setViewerItemIndex(viewerItemIndex - 1);
    } else if (viewerGroupIndex > 0) {
      const prevGroup = viewerGroupIndex - 1;
      setViewerGroupIndex(prevGroup);
      setViewerItemIndex(pulseGroups[prevGroup].items.length - 1);
    }
  }

  async function reactToPulse(pulseId: string, emoji: string) {
    if (!userId) return;
    await supabase.from("pulse_reactions").upsert({ pulse_id: pulseId, user_id: userId, emoji }, { onConflict: "pulse_id,user_id" });
  }

  async function sendPulseReply(pulseId: string) {
    if (!userId || !viewerReplyDraft.trim()) return;
    const text = viewerReplyDraft.trim();
    setViewerReplyDraft("");
    await supabase.from("pulse_replies").insert({ pulse_id: pulseId, sender_id: userId, content: text });
  }

  async function confirmDeletePulse() {
    if (!deletePulseTarget) return;
    await supabase.from("pulses").delete().eq("id", deletePulseTarget.id);
    setDeletePulseTarget(null);
    setViewerOpen(false);
    setPulsesLoaded(false);
    await loadPulses();
  }

  async function savePulsePrivacy() {
    if (!userId) return;
    setSavingPrivacy(true);
    await supabase.from("profiles").update({ pulse_privacy: pulsePrivacy }).eq("id", userId);
    setSavingPrivacy(false);
    setPrivacyOpen(false);
  }

  async function loadCategory(category: string) {
    setSelectedCategory(category);
    setSearchResults(null);
    setSearchQuery("");
    setExplorePosts(null);
    setExploreExternal(null);
    setExploreExternalError(null);
    setExploreLoading(true);

    const externalConfig = EXTERNAL_CATEGORY_TABLES[category];
    if (externalConfig) {
      const { data, error } = await supabase.from(externalConfig.table).select(externalConfig.select).order(externalConfig.orderBy, { ascending: externalConfig.ascending }).limit(30);
      if (error) {
        console.error(error);
        setExploreExternalError(error.message);
        setExploreLoading(false);
        return;
      }
      setExploreExternal((data ?? []) as unknown as ExternalItem[]);
      setExploreLoading(false);
      return;
    }

    if (category === "Videos") {
      const [discoverRes, sportsRes] = await Promise.all([
        supabase.from("discover_posts").select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").order("created_at", { ascending: false }).limit(100),
        supabase.from("sports_updates").select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").order("created_at", { ascending: false }).limit(100),
      ]);
      if (discoverRes.error || sportsRes.error) {
        const msg = discoverRes.error?.message || sportsRes.error?.message || "unknown error";
        alert("Load videos failed: " + msg);
        setExploreLoading(false);
        return;
      }
      const merged = [...(discoverRes.data ?? []).map(mapDiscoverRow), ...(sportsRes.data ?? []).map(mapSportsRow)]
        .filter((p) => p.video_urls.length > 0)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);
      setExplorePosts(merged);
      setExploreLoading(false);
      await loadEngagementFor(merged);
      return;
    }

    const [discoverRes, sportsRes] = await Promise.all([
      supabase.from("discover_posts").select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").eq("category", category).order("created_at", { ascending: false }).limit(30),
      supabase.from("sports_updates").select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").eq("category", category).order("created_at", { ascending: false }).limit(30),
    ]);
    const merged = [...(discoverRes.data ?? []).map(mapDiscoverRow), ...(sportsRes.data ?? []).map(mapSportsRow)].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
    setExploreExternal(null);
    const [discoverRes, sportsRes] = await Promise.all([
      supabase.from("discover_posts").select("id, user_id, content, image_url, video_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").ilike("content", `%${q}%`).order("created_at", { ascending: false }).limit(30),
      supabase.from("sports_updates").select("id, user_id, title, description, image_url, image_urls, video_urls, created_at, category, profiles(first_name, avatar_url)").or(`title.ilike.%${q}%,description.ilike.%${q}%`).order("created_at", { ascending: false }).limit(30),
    ]);
    const merged = [...(discoverRes.data ?? []).map(mapDiscoverRow), ...(sportsRes.data ?? []).map(mapSportsRow)].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setSearchResults(merged);
    setSearching(false);
    await loadEngagementFor(merged);
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
    setExplorePosts((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
    setSearchResults((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
    setFollowingFeed((prev) => (prev ? prev.filter((p) => !(p.source === post.source && p.id === post.id)) : prev));
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
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type]) => REACTIONS.find((r) => r.type === type)).filter(Boolean) as typeof REACTIONS;

    return (
      <div key={k} className="relative border-b border-hub-border bg-hub-card px-4 py-3">
        <div ref={(el) => { menuScopeRefs.current[k] = el; }} className="relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                {post.avatar_url ? <img src={post.avatar_url} alt="" className="h-full w-full object-cover" /> : post.first_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{post.first_name}</p>
                <p className="text-[11px] text-hub-textDim">{timeAgo(post.created_at)}{post.category ? ` · ${post.category}` : ""}</p>
              </div>
            </div>
            <button onClick={() => setMenuOpenFor(menuOpenFor === k ? null : k)} className="shrink-0 text-hub-textDim px-1"><MoreIcon /></button>
          </div>

          {menuOpenFor === k && (
            <div className="absolute right-0 top-11 z-20 w-48 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
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

        {post.text && <p className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{linkifyContent(post.text)}</p>}
        {post.description && <p className="mt-1 text-xs text-hub-textDim whitespace-pre-wrap">{linkifyContent(post.description)}</p>}

        <MediaCarousel images={post.image_urls} videos={post.video_urls} registerVideoRef={registerVideoRef} />

        <div ref={(el) => { reactionScopeRefs.current[k] = el; }} className="relative mt-3 flex items-center justify-between border-t border-hub-border pt-3">
          {reactionPickerFor === k && (
            <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-hub-border bg-hub-card2 px-4 py-3 shadow-xl">
              <div className="flex items-start gap-4">
                {REACTION_TOP.map((r) => (
                  <button key={r.type} onClick={() => pickReaction(post, r.type)} disabled={reactingKey === k} className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}>{r.type === "like" ? <ThumbsUpIcon className="text-white" filled /> : <span className="text-lg leading-none">{r.emoji}</span>}</span>
                    <span className="text-[10px] text-hub-textDim">{r.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-4">
                {REACTION_BOTTOM.map((r) => (
                  <button key={r.type} onClick={() => pickReaction(post, r.type)} disabled={reactingKey === k} className={`flex flex-col items-center gap-1 transition-transform active:scale-110 ${myReaction === r.type ? "scale-105" : ""}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r.bg}`}><span className="text-lg leading-none">{r.emoji}</span></span>
                    <span className="text-[10px] text-hub-textDim">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setReactionPickerFor((prev) => (prev === k ? null : k))} className={`flex items-center gap-1.5 text-xs ${activeReactionInfo ? "text-hub-accentLight" : "text-hub-textDim"}`}>
            {topTypes.length > 0 ? (
              <span className="flex items-center">
                {topTypes.map((r, i) => (
                  <span key={r.type} className={`flex h-5 w-5 items-center justify-center rounded-full border border-hub-card ${r.bg} ${i > 0 ? "-ml-1.5" : ""}`}>
                    {r.type === "like" ? <ThumbsUpIcon className="text-white" filled small /> : <span className="text-[10px] leading-none">{r.emoji}</span>}
                  </span>
                ))}
              </span>
            ) : (
              <ThumbsUpIcon className="text-hub-textDim" />
            )}
            {postReactions.length > 0 && <span>{postReactions.length}</span>}
          </button>

          <button onClick={() => setCommentOpenFor(commentOpenFor === k ? null : k)} className="flex items-center gap-1.5 text-xs text-hub-textDim">
            <CommentIcon />{allComments.length > 0 && <span>{allComments.length}</span>}
          </button>

          <button onClick={() => sharePost(post)} className="flex items-center gap-1.5 text-xs text-hub-textDim"><ShareIcon /></button>

          {post.source === "discover" && (
            <button onClick={() => toggleBookmark(post)} className={`shrink-0 ${isSaved ? "text-hub-accentLight" : "text-hub-textDim"}`}><BookmarkIcon filled={isSaved} /></button>
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

  function renderPersonRow(person: Person) {
    const isFollowing = followingIds.has(person.id);
    return (
      <div key={person.id} className="flex items-center gap-3 border-b border-hub-border px-5 py-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-sm font-medium text-white">
          {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : (person.first_name || "S").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{person.first_name || "Student"}</p>
          {person.bio && <p className="truncate text-xs text-hub-textDim">{person.bio}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => handleMessage(person.id)} disabled={messageBusyId === person.id} className="rounded-full border border-hub-border px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
            {messageBusyId === person.id ? "..." : "Message"}
          </button>
          <button onClick={() => toggleFollow(person.id)} disabled={followBusyId === person.id} className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${isFollowing ? "border border-hub-border text-white" : "bg-hub-accentLight text-white"}`}>
            {followBusyId === person.id ? "..." : isFollowing ? "Following" : "Follow"}
          </button>
        </div>
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

  const isExternalCategory = selectedCategory ? !!EXTERNAL_CATEGORY_TABLES[selectedCategory] : false;
  const suggestedPeople = people.filter((p) => !followingIds.has(p.id));
  const activeViewerGroup = pulseGroups[viewerGroupIndex];
  const activeViewerItem = activeViewerGroup?.items[viewerItemIndex];
  const myGroup = pulseGroups.find((g) => g.isMine);
  const otherGroups = pulseGroups.filter((g) => !g.isMine);
  const newUpdates = otherGroups.filter((g) => g.hasUnviewed);
  const viewedUpdates = otherGroups.filter((g) => !g.hasUnviewed);

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

        <button onClick={() => router.push("/profile")} className="mt-4 flex w-full items-center gap-3 rounded-full border border-hub-border bg-hub-card px-3 py-2.5 text-left">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
            {myAvatarUrl ? <img src={myAvatarUrl} alt="" className="h-full w-full object-cover" /> : myFirstName?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <span className="text-sm text-hub-textDim">Share something from your Profile...</span>
        </button>
      </div>

      {activeTab === "For You" && (
        <div className="mt-3">
          {forYouLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}
          {!forYouLoading && forYouPosts && forYouPosts.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-hub-textDim">Nothing here yet — post something from your Profile to get started.</p>
          )}
          {!forYouLoading && (forYouPosts ?? []).map(renderPostCard)}
        </div>
      )}

      {activeTab === "Following" && (
        <div className="mt-3">
          <div className="flex border-b border-hub-border px-5">
            {followingSubTabs.map((tab) => (
              <button key={tab} onClick={() => setFollowingSubTab(tab)} className={`mr-6 pb-2.5 text-sm font-medium border-b-2 -mb-px ${followingSubTab === tab ? "border-hub-accentLight text-white" : "border-transparent text-hub-textDim"}`}>
                {tab}
              </button>
            ))}
          </div>

          {followingSubTab === "People" && (
            <div>
              <div className="border-b border-hub-border px-5 py-3">
                <p className="text-sm font-medium text-white">People you follow</p>
                <p className="text-xs text-hub-textDim">{followingIds.size} people</p>
              </div>
              {followedProfiles.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-hub-textDim">You&apos;re not following anyone yet — follow people below.</p>
              ) : (
                followedProfiles.map(renderPersonRow)
              )}
              <div className="border-b border-t border-hub-border px-5 py-3"><p className="text-sm font-medium text-white">Find people</p></div>
              {suggestedPeople.map(renderPersonRow)}
              {peopleHasMore && (
                <div className="px-5 py-4">
                  <button onClick={() => loadPeople(false)} disabled={peopleLoading} className="w-full rounded-full border border-hub-border py-2 text-center text-xs font-medium text-hub-accentLight disabled:opacity-40">
                    {peopleLoading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </div>
          )}

          {followingSubTab === "Posts" && (
            <div className="mt-1">
              {followingFeedLoading && <p className="px-5 py-6 text-center text-sm text-hub-textDim">Loading...</p>}
              {!followingFeedLoading && followingIds.size === 0 && <p className="px-5 py-6 text-center text-sm text-hub-textDim">Follow people to see their posts here.</p>}
              {!followingFeedLoading && followingIds.size > 0 && followingFeed && followingFeed.length === 0 && <p className="px-5 py-6 text-center text-sm text-hub-textDim">No posts yet from people you follow.</p>}
              {!followingFeedLoading && (followingFeed ?? []).map(renderPostCard)}
            </div>
          )}

          {followingSubTab === "Pulse" && (
            <div className="mt-2">
              <input ref={pulseFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) openMediaComposer(e.target.files[0]); e.target.value = ""; }} />
              <input ref={pulseCameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.[0]) openMediaComposer(e.target.files[0]); e.target.value = ""; }} />

              {pulseLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}

              {!pulseLoading && (
                <>
                  <div className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-semibold text-white">My Pulse</p>
                    <button onClick={() => setPrivacyOpen(true)} className="text-xs text-hub-accentLight">Privacy</button>
                  </div>
                  <button onClick={() => (myGroup ? openViewer(pulseGroups.findIndex((g) => g.isMine)) : setAddPulseOpen(true))} className="flex w-full items-center gap-3 px-5 pb-4 text-left">
                    <div className="relative h-14 w-14 shrink-0">
                      <div className={`h-14 w-14 rounded-full p-[2px] ${myGroup ? "bg-gradient-to-tr from-hub-accentLight to-purple-400" : ""}`}>
                        <div className="h-full w-full overflow-hidden rounded-full border-2 border-hub-bg bg-hub-card2 flex items-center justify-center text-sm font-medium text-white">
                          {myAvatarUrl ? <img src={myAvatarUrl} alt="" className="h-full w-full object-cover" /> : myFirstName?.charAt(0).toUpperCase() ?? "U"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddPulseOpen(true); }}
                        className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-hub-accentLight text-xs text-white border-2 border-hub-bg"
                      >
                        {uploadingPulse ? "..." : "+"}
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{myGroup ? "Tap to view your Pulse" : "Add to Pulse"}</p>
                      <p className="text-xs text-hub-textDim">{myGroup ? `${myGroup.items.length} update${myGroup.items.length > 1 ? "s" : ""}` : "Share an update with your campus"}</p>
                    </div>
                  </button>

                  {newUpdates.length > 0 && (
                    <>
                      <p className="px-5 pb-2 text-xs font-medium text-hub-textDim">Recent updates</p>
                      {newUpdates.map((group) => (
                        <button key={group.user_id} onClick={() => openViewer(pulseGroups.findIndex((g) => g.user_id === group.user_id))} className="flex w-full items-center gap-3 border-b border-hub-border px-5 py-3 text-left">
                          <div className="h-12 w-12 shrink-0 rounded-full p-[2px] bg-gradient-to-tr from-hub-accentLight to-purple-400">
                            <div className="h-full w-full overflow-hidden rounded-full border-2 border-hub-bg bg-hub-card2 flex items-center justify-center text-xs font-medium text-white">
                              {group.avatar_url ? <img src={group.avatar_url} alt="" className="h-full w-full object-cover" /> : group.first_name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{group.first_name}</p>
                            <p className="text-xs text-hub-textDim">{timeAgo(group.items[group.items.length - 1].created_at)}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {viewedUpdates.length > 0 && (
                    <>
                      <p className="px-5 py-2 text-xs font-medium text-hub-textDim">Viewed updates</p>
                      {viewedUpdates.map((group) => (
                        <button key={group.user_id} onClick={() => openViewer(pulseGroups.findIndex((g) => g.user_id === group.user_id))} className="flex w-full items-center gap-3 border-b border-hub-border px-5 py-3 text-left">
                          <div className="h-12 w-12 shrink-0 rounded-full border-2 border-hub-border overflow-hidden bg-hub-card2 flex items-center justify-center text-xs font-medium text-white">
                            {group.avatar_url ? <img src={group.avatar_url} alt="" className="h-full w-full object-cover" /> : group.first_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{group.first_name}</p>
                            <p className="text-xs text-hub-textDim">{timeAgo(group.items[group.items.length - 1].created_at)}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {otherGroups.length === 0 && (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-white/90">No active Pulses yet</p>
                      <p className="mt-1 text-xs text-hub-textDim">Share an update with your campus community.</p>
                      <button onClick={() => setAddPulseOpen(true)} className="mt-4 rounded-full bg-hub-accentLight px-5 py-2 text-sm font-medium text-white">Add Pulse</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "Explore" && (
        <div className="mt-3">
          <div className="px-5">
            <div className="flex items-center gap-2 rounded-full border border-hub-border bg-hub-card px-3 py-2">
              <SearchIcon />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="Search posts..." className="flex-1 bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none" />
              {searchQuery && <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="text-hub-textDim">×</button>}
            </div>
          </div>

          {searchResults === null && (
            <div className="mt-4 px-5">
              <div className="grid grid-cols-2 gap-3">
                {EXPLORE_CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => loadCategory(cat)} className={`rounded-xl border p-4 text-left ${selectedCategory === cat ? "border-hub-accentLight bg-hub-accentLight/10" : "border-hub-border bg-hub-card"}`}>
                    <span className="text-sm font-medium text-white">{cat}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults === null && selectedCategory && isExternalCategory && (
            <div className="mt-4 px-5">
              <p className="pb-2 text-sm font-medium text-hub-textDim">{selectedCategory}</p>
              {exploreLoading && <p className="text-center text-sm text-hub-textDim">Loading...</p>}
              {exploreExternalError && <p className="py-4 text-center text-sm text-red-400">Couldn&apos;t load {selectedCategory}: {exploreExternalError}</p>}
              {!exploreLoading && !exploreExternalError && exploreExternal && exploreExternal.length === 0 && <p className="py-6 text-center text-sm text-hub-textDim">Nothing here yet.</p>}
              {!exploreLoading && !exploreExternalError && (exploreExternal ?? []).map((item) => (
                <button key={item.id} onClick={() => router.push(EXTERNAL_CATEGORY_TABLES[selectedCategory].route)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-hub-border bg-hub-card p-3 text-left">
                  {item.image_urls && item.image_urls[0] && <img src={item.image_urls[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    {selectedCategory === "Marketplace" && item.price != null && <p className="text-xs text-hub-accentLight">₦{Number(item.price).toLocaleString()}</p>}
                    {selectedCategory === "Events" && item.event_date && <p className="text-xs text-hub-textDim">{new Date(item.event_date).toLocaleDateString()}{item.event_time ? ` · ${item.event_time}` : ""}{item.location ? ` · ${item.location}` : ""}</p>}
                    {selectedCategory === "Study" && item.subject && <p className="truncate text-xs text-hub-textDim">{item.subject}</p>}
                  </div>
                </button>
              ))}
              {!exploreLoading && !exploreExternalError && (
                <button onClick={() => router.push(EXTERNAL_CATEGORY_TABLES[selectedCategory].route)} className="mt-1 w-full rounded-lg border border-hub-border py-2 text-center text-xs font-medium text-hub-accentLight">
                  Open full {selectedCategory} page →
                </button>
              )}
            </div>
          )}

          {searchResults === null && selectedCategory && !isExternalCategory && (
            <div className="mt-4">
              <p className="px-5 pb-2 text-sm font-medium text-hub-textDim">{selectedCategory}</p>
              {exploreLoading && <p className="px-5 text-center text-sm text-hub-textDim">Loading...</p>}
              {!exploreLoading && explorePosts && explorePosts.length === 0 && <p className="px-5 py-6 text-center text-sm text-hub-textDim">No posts in this category yet.</p>}
              {!exploreLoading && (explorePosts ?? []).map(renderPostCard)}
            </div>
          )}

          {searchResults !== null && (
            <div className="mt-4">
              {searching && <p className="px-5 text-center text-sm text-hub-textDim">Searching...</p>}
              {!searching && searchResults.length === 0 && <p className="px-5 py-6 text-center text-sm text-hub-textDim">No results for &quot;{searchQuery}&quot;.</p>}
              {!searching && searchResults.map(renderPostCard)}
            </div>
          )}
        </div>
      )}

      {/* Add Pulse sheet */}
      {addPulseOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setAddPulseOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl border-t border-hub-border bg-hub-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-white">Add Pulse</p>
              <button onClick={() => setAddPulseOpen(false)} className="text-hub-textDim">✕</button>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <button onClick={() => { setAddPulseOpen(false); pulseCameraInputRef.current?.click(); }} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hub-card2 border border-hub-border text-white">📷</span>
                <div><p className="text-sm font-medium text-white">Camera</p><p className="text-xs text-hub-textDim">Take a photo or video</p></div>
              </button>
              <button onClick={() => { setAddPulseOpen(false); pulseFileInputRef.current?.click(); }} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hub-card2 border border-hub-border text-white">🖼️</span>
                <div><p className="text-sm font-medium text-white">Photo/Video</p><p className="text-xs text-hub-textDim">Choose from your gallery</p></div>
              </button>
              <button onClick={() => { setAddPulseOpen(false); setTextPulseOpen(true); }} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hub-card2 border border-hub-border text-white">Aa</span>
                <div><p className="text-sm font-medium text-white">Text</p><p className="text-xs text-hub-textDim">Create a text Pulse</p></div>
              </button>
              <button onClick={() => { setAddPulseOpen(false); setVoicePulseOpen(true); }} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hub-card2 border border-hub-border text-white">🎤</span>
                <div><p className="text-sm font-medium text-white">Voice</p><p className="text-xs text-hub-textDim">Record a voice Pulse</p></div>
              </button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1 text-center text-[11px] text-hub-textDim">🔒 Your Pulse will disappear after 24 hours.</p>
          </div>
        </div>
      )}

      {/* Media composer */}
      {mediaComposerFile && mediaComposerPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => { setMediaComposerFile(null); setMediaComposerPreview(null); }} className="text-white text-lg">✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {mediaComposerFile.type.startsWith("video") ? (
              <video src={mediaComposerPreview} controls className="max-h-full max-w-full" />
            ) : (
              <img src={mediaComposerPreview} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <div className="flex items-center gap-2 p-4">
            <input
              value={mediaComposerCaption}
              onChange={(e) => setMediaComposerCaption(e.target.value)}
              placeholder="Add a caption..."
              className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 outline-none"
            />
            <button onClick={() => requestShare("media")} disabled={uploadingPulse} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hub-accentLight text-white disabled:opacity-50">
              {uploadingPulse ? "..." : "➤"}
            </button>
          </div>
        </div>
      )}

      {/* Text composer */}
      {textPulseOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: textPulseColor }}>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setTextPulseOpen(false)} className="text-white">✕</button>
            <button onClick={() => requestShare("text")} disabled={uploadingPulse || !textPulseDraft.trim()} className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40">
              {uploadingPulse ? "Posting..." : "Post"}
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-8">
            <textarea
              value={textPulseDraft}
              onChange={(e) => setTextPulseDraft(e.target.value.slice(0, 120))}
              placeholder="Type a Pulse..."
              autoFocus
              rows={4}
              className="w-full resize-none bg-transparent text-center text-2xl font-medium text-white placeholder:text-white/60 outline-none"
            />
          </div>
          <div className="flex justify-center gap-3 p-6">
            {TEXT_PULSE_COLORS.map((c) => (
              <button key={c} onClick={() => setTextPulseColor(c)} className={`h-8 w-8 rounded-full border-2 ${textPulseColor === c ? "border-white" : "border-transparent"}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      )}

      {/* Voice composer */}
      {voicePulseOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-hub-bg">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => { setVoicePulseOpen(false); setRecordedBlob(null); setRecordSeconds(0); }} className="text-white">✕</button>
            <p className="text-sm font-medium text-white">Voice Pulse</p>
            <span className="w-5" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex h-28 w-28 items-center justify-center rounded-full border-4 ${recording ? "border-red-400" : "border-hub-accentLight"}`}
            >
              <span className="text-3xl">🎤</span>
            </button>
            <p className="text-2xl font-semibold text-white">{formatDuration(recordSeconds)}</p>
            <p className="text-xs text-hub-textDim">{recording ? "Recording... tap to stop" : recordedBlob ? "Recorded — ready to post" : "Tap to record"}</p>
            {recordedBlob && (
              <button onClick={() => requestShare("voice")} disabled={uploadingPulse} className="rounded-full bg-hub-accentLight px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {uploadingPulse ? "Posting..." : "Post Voice Pulse"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Share confirmation */}
      {shareConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-hub-card p-5">
            <p className="text-center text-base font-semibold text-white">Share to Pulse</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-hub-textDim">Audience</span>
              <span className="text-white capitalize">{pulsePrivacy}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-hub-textDim">Duration</span>
              <span className="text-white">24 hours</span>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => { setShareConfirmOpen(false); setPendingPulse(null); }} className="flex-1 rounded-full border border-hub-border py-2.5 text-sm font-medium text-white">Cancel</button>
              <button onClick={confirmShare} className="flex-1 rounded-full bg-hub-accentLight py-2.5 text-sm font-medium text-white">Share Pulse</button>
            </div>
          </div>
        </div>
      )}

      {/* Share success */}
      {shareSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-hub-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-400 text-2xl text-green-400">✓</div>
            <p className="text-base font-semibold text-white">Pulse posted successfully</p>
            <p className="mt-1 text-xs text-hub-textDim">Your Pulse is now visible to your selected audience.</p>
            <button onClick={() => setShareSuccessOpen(false)} className="mt-5 w-full rounded-full bg-hub-accentLight py-2.5 text-sm font-medium text-white">Done</button>
          </div>
        </div>
      )}

      {/* Privacy screen */}
      {privacyOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setPrivacyOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl border-t border-hub-border bg-hub-card p-5">
            <p className="text-base font-semibold text-white">Pulse Privacy</p>
            <p className="mt-1 text-xs text-hub-textDim">Choose who can see your Pulse updates.</p>
            <div className="mt-4 flex flex-col gap-1">
              {[
                { key: "everyone", label: "Everyone", desc: "Anyone on Uni.hub can see your Pulse." },
                { key: "campus", label: "My Campus", desc: "Students from your campus can see your Pulse." },
                { key: "selected", label: "Selected People", desc: "Choose specific people who can see your Pulse." },
                { key: "hidden", label: "Hide From", desc: "Choose people who should not see your Pulse." },
              ].map((opt) => (
                <button key={opt.key} onClick={() => setPulsePrivacy(opt.key)} className="flex items-start gap-3 rounded-lg px-2 py-2.5 text-left">
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${pulsePrivacy === opt.key ? "border-hub-accentLight bg-hub-accentLight" : "border-hub-border"}`} />
                  <div><p className="text-sm text-white">{opt.label}</p><p className="text-xs text-hub-textDim">{opt.desc}</p></div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-hub-textDim">🔒 Your selection will be used for future Pulse updates.</p>
            <button onClick={savePulsePrivacy} disabled={savingPrivacy} className="mt-4 w-full rounded-full bg-hub-accentLight py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {savingPrivacy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletePulseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-hub-card p-5 text-center">
            <p className="text-base font-semibold text-white">Delete Pulse?</p>
            <p className="mt-1 text-xs text-hub-textDim">This Pulse will be removed for everyone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeletePulseTarget(null)} className="flex-1 rounded-full border border-hub-border py-2.5 text-sm font-medium text-white">Cancel</button>
              <button onClick={confirmDeletePulse} className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* My Pulse viewers sheet */}
      {myPulseViewersOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70" onClick={() => setMyPulseViewersOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl border-t border-hub-border bg-hub-card p-5">
            <p className="text-sm font-semibold text-white">Viewed by ({myPulseViewers.length})</p>
            <div className="mt-3 flex flex-col gap-3">
              {myPulseViewers.length === 0 && <p className="text-xs text-hub-textDim">No views yet.</p>}
              {myPulseViewers.map((v) => (
                <div key={v.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                    {v.avatar_url ? <img src={v.avatar_url} alt="" className="h-full w-full object-cover" /> : v.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1"><p className="text-sm text-white">{v.first_name}</p></div>
                  <span className="text-[11px] text-hub-textDim">{timeAgo(v.viewed_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pulse viewer */}
      {viewerOpen && activeViewerGroup && activeViewerItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex gap-1 px-3 pt-3">
            {activeViewerGroup.items.map((item, idx) => (
              <div key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <div className="h-full bg-white" style={{ width: idx < viewerItemIndex ? "100%" : idx === viewerItemIndex ? `${viewerProgress}%` : "0%" }} />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-hub-card2 border border-white/20 flex items-center justify-center text-xs font-medium text-white">
                {activeViewerGroup.avatar_url ? <img src={activeViewerGroup.avatar_url} alt="" className="h-full w-full object-cover" /> : activeViewerGroup.first_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-white">{activeViewerGroup.isMine ? "My Pulse" : activeViewerGroup.first_name}</span>
              <span className="text-xs text-white/60">{timeAgo(activeViewerItem.created_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              {activeViewerGroup.isMine && (
                <button onClick={() => setDeletePulseTarget(activeViewerItem)} className="text-white text-lg">🗑️</button>
              )}
              <button onClick={closeViewer} className="text-white"><CloseIcon /></button>
            </div>
          </div>

          <div
            className="relative flex-1"
            onMouseDown={() => setViewerPaused(true)}
            onMouseUp={() => setViewerPaused(false)}
            onTouchStart={() => setViewerPaused(true)}
            onTouchEnd={() => setViewerPaused(false)}
          >
            {activeViewerItem.media_type === "video" ? (
              <video key={activeViewerItem.id} src={activeViewerItem.media_url} autoPlay muted className="h-full w-full object-contain" />
            ) : activeViewerItem.media_type === "voice" ? (
              <div className="flex h-full w-full items-center justify-center">
                <audio key={activeViewerItem.id} src={activeViewerItem.media_url} autoPlay controls className="w-4/5" />
              </div>
            ) : (
              <img key={activeViewerItem.id} src={activeViewerItem.media_url} alt="" className="h-full w-full object-contain" />
            )}
            {activeViewerItem.caption && (
              <p className="absolute bottom-4 left-0 right-0 px-6 text-center text-sm text-white">{activeViewerItem.caption}</p>
            )}
            <button onClick={goPrevItem} className="absolute left-0 top-0 h-full w-1/3" aria-label="Previous" />
            <button onClick={goNextItem} className="absolute right-0 top-0 h-full w-1/3" aria-label="Next" />
          </div>

          {activeViewerGroup.isMine ? (
            <button onClick={() => loadMyPulseViewers(activeViewerItem.id).then(() => setMyPulseViewersOpen(true))} className="flex items-center justify-center gap-2 border-t border-white/10 py-3 text-sm text-white">
              👁 {myPulseViewers.length} views
            </button>
          ) : (
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
              <input
                value={viewerReplyDraft}
                onChange={(e) => setViewerReplyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendPulseReply(activeViewerItem.id); }}
                placeholder="Reply to this Pulse..."
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none"
              />
              {PULSE_REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => reactToPulse(activeViewerItem.id, emoji)} className="text-xl">{emoji}</button>
              ))}
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
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
