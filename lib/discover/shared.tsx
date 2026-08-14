"use client";

import { useState, useRef, useEffect } from "react";
import type { RefObject, ReactNode } from "react";

export type Post = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  image_urls?: string[] | null;
  video_urls?: string[] | null;
  hashtags: string[];
  created_at: string;
  first_name?: string;
  department?: string | null;
};

export type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";
export type ReactionRecord = { type: ReactionType; user_id: string; first_name: string };

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  first_name?: string;
};

export type CommentLikeShape = {
  id: string;
  first_name?: string;
  content: string;
  created_at: string;
};

export type SportsUpdate = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  video_urls?: string[] | null;
  category: string;
  created_at: string;
  first_name?: string;
};

export type SportsComment = {
  id: string;
  sports_update_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  first_name?: string;
};

export const REACTIONS: { type: ReactionType; emoji: string | null; label: string; bg: string }[] = [
  { type: "like", emoji: null, label: "Like", bg: "bg-hub-accentLight" },
  { type: "love", emoji: "❤️", label: "Love", bg: "bg-red-500" },
  { type: "care", emoji: "🥰", label: "Care", bg: "bg-yellow-400" },
  { type: "haha", emoji: "😆", label: "Haha", bg: "bg-yellow-400" },
  { type: "wow", emoji: "😮", label: "Wow", bg: "bg-yellow-400" },
  { type: "sad", emoji: "😢", label: "Sad", bg: "bg-yellow-400" },
  { type: "angry", emoji: "😠", label: "Angry", bg: "bg-orange-500" },
];
export const REACTION_TOP = REACTIONS.slice(0, 3);
export const REACTION_BOTTOM = REACTIONS.slice(3);

export const DISCOVER_TABS = [
  { label: "For You", href: "/discover" },
  { label: "Following", href: "/discover/following" },
  { label: "Sports", href: "/discover/sports" },
  { label: "News", href: "/discover/news" },
  { label: "Clubs", href: "/discover/clubs" },
];

export const URL_REGEX = /(https?:\/\/[^\s]+)/g;
export const MAX_MEDIA_PER_TYPE = 5;

export const SPORTS_CATEGORY_OPTIONS = [
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

export function linkifyContent(text: string) {
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

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function reactionSummaryText(records: ReactionRecord[], userId: string | null) {
  if (records.length === 0) return null;
  const mine = records.find((r) => r.user_id === userId);
  const others = records.filter((r) => r.user_id !== userId);
  if (mine && others.length === 0) return "You reacted";
  if (mine) return `You and ${others.length} other${others.length > 1 ? "s" : ""} reacted`;
  const first = records[0];
  const rest = records.length - 1;
  return rest > 0 ? `${first.first_name} and ${rest} other${rest > 1 ? "s" : ""} reacted` : `${first.first_name} reacted`;
}

type MediaItem = { type: "image" | "video"; url: string };

function MediaLightbox({
  items,
  startIndex,
  onClose,
}: {
  items: MediaItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const child = container?.children[startIndex] as HTMLElement | undefined;
    if (container && child) {
      container.scrollTo({ left: child.offsetLeft, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const container = e.currentTarget;
    const width = container.clientWidth || 1;
    const i = Math.round(container.scrollLeft / width);
    if (i !== index) setIndex(i);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white"
      >
        ×
      </button>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-1 items-center overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {items.map((item, i) => (
          <div key={i} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {item.type === "image" ? (
              <img src={item.url} alt={`Media ${i + 1}`} className="max-h-full max-w-full object-contain" />
            ) : (
              <video src={item.url} controls autoPlay className="max-h-full max-w-full object-contain" />
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-6 pt-2">
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaCarousel({
  images,
  videos,
  registerVideoRef,
}: {
  images: string[];
  videos: string[];
  registerVideoRef?: (el: HTMLVideoElement | null) => void;
}) {
  const items: MediaItem[] = [...images.map((u) => ({ type: "image" as const, url: u })), ...videos.map((u) => ({ type: "video" as const, url: u }))];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      {items.length === 1 ? (
        <div className="-mx-4 mt-3 overflow-hidden bg-black">
          {items[0].type === "image" ? (
            <img
              src={items[0].url}
              alt="Post media"
              loading="lazy"
              onClick={() => setLightboxIndex(0)}
              className="block max-h-[480px] w-full object-contain cursor-zoom-in"
            />
          ) : (
            <video ref={registerVideoRef} src={items[0].url} controls preload="metadata" className="block w-full" />
          )}
        </div>
      ) : (
        <div className="-mx-4 mt-3 flex gap-1 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {items.map((item, i) => (
            <div key={i} className="relative shrink-0 w-[92%] snap-center overflow-hidden bg-black">
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={`Post media ${i + 1}`}
                  loading="lazy"
                  onClick={() => setLightboxIndex(i)}
                  className="block h-72 w-full object-contain cursor-zoom-in"
                />
              ) : (
                <video ref={registerVideoRef} src={item.url} controls preload="metadata" className="block h-72 w-full object-contain" />
              )}
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                {i + 1}/{items.length}
              </span>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox items={items} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}

export function MediaPicker({
  images,
  videos,
  onAddImages,
  onAddVideos,
  onRemoveImage,
  onRemoveVideo,
  imageInputRef,
  videoInputRef,
}: {
  images: File[];
  videos: File[];
  onAddImages: (files: File[]) => void;
  onAddVideos: (files: File[]) => void;
  onRemoveImage: (i: number) => void;
  onRemoveVideo: (i: number) => void;
  imageInputRef: RefObject<HTMLInputElement>;
  videoInputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <>
      {(images.length > 0 || videos.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((f, i) => (
            <div key={`img-${i}`} className="flex items-center gap-1 rounded-md bg-hub-card2 px-2 py-1 text-[10px] text-hub-textDim">
              <PhotoIcon />
              <span className="max-w-[90px] truncate">{f.name}</span>
              <button onClick={() => onRemoveImage(i)} className="text-red-400">×</button>
            </div>
          ))}
          {videos.map((f, i) => (
            <div key={`vid-${i}`} className="flex items-center gap-1 rounded-md bg-hub-card2 px-2 py-1 text-[10px] text-hub-textDim">
              <VideoIcon />
              <span className="max-w-[90px] truncate">{f.name}</span>
              <button onClick={() => onRemoveVideo(i)} className="text-red-400">×</button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAddImages(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAddVideos(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </>
  );
}

export function CommentRow({
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

export function PhotoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
export function ThumbsUpIcon({ className, filled, small }: { className?: string; filled?: boolean; small?: boolean }) {
  const size = small ? 10 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={className}>
      <path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm0 0l4.5-8a2 2 0 013.7 1.6L14 9h5a2 2 0 012 2.2l-1.3 7A2 2 0 0117.7 20H10a3 3 0 01-3-3v-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
export function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path d="M6 3h12v18l-6-4-6 4V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
export function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.6 5.1A10.9 10.9 0 0112 5c5 0 9 4 10 7-.5 1.2-1.5 2.8-3 4.1M6.5 6.6C4.2 8 2.6 10.1 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 3.9-.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 12a2.5 2.5 0 003.6 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
export function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function BellSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 15l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 6l1-1a4 4 0 015.7 5.7l-1 1M13 18l-1 1a4 4 0 01-5.7-5.7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
export function PlusCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function MinusCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function TrophyIcon({ small }: { small?: boolean }) {
  const size = small ? 20 : 28;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 4h8v5a4 4 0 01-8 0V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 5H5a3 3 0 003 3M16 5h3a3 3 0 01-3 3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 13v3M14 13v3M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
