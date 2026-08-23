"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import emojiData from "@emoji-mart/data";
import { supabase } from "@/lib/supabaseClient";

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), { ssr: false });

type Msg = {
  id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size_kb: number | null;
  created_at: string;
  senderName: string;
};

type Participant = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
  last_read_at: string | null;
};

type GifResult = { id: string; preview: string; full: string };

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];

function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function timeShort(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function isAudioAttachment(name: string | null) {
  return !!name && /\.(webm|mp3|m4a|wav|ogg)$/i.test(name);
}
function isImageAttachment(name: string | null) {
  return !!name && /\.(png|jpe?g|gif|webp)$/i.test(name);
}

const NAME_COLORS = ["text-hub-accentLight", "text-emerald-400", "text-pink-400", "text-orange-400", "text-purple-400", "text-cyan-400"];
function colorForSender(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

function VoiceNotePlayer({ url, isMine }: { url: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex min-w-[190px] items-center gap-2">
      <button
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isMine ? "bg-white/20" : "bg-hub-accentLight"}`}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="flex-1">
        <div className="h-1 w-full rounded-full bg-white/25">
          <div className="h-1 rounded-full bg-white" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[10px] opacity-80">
          {formatDuration(current)} / {formatDuration(duration || 0)}
        </p>
      </div>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        className="hidden"
      />
    </div>
  );
}

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  // Accepts either [id] or [conversationId] as the folder name — avoids
  // "invalid input syntax for type uuid: undefined" if they don't match.
  const conversationId = (params?.id ?? params?.conversationId) as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [convType, setConvType] = useState<"direct" | "group">("direct");
  const [convName, setConvName] = useState("Conversation");
  const [convAvatar, setConvAvatar] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [otherUser, setOtherUser] = useState<Participant | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"emoji" | "gif">("emoji");
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);
      await loadConversation(data.user.id);
      await loadMessages();
      await markRead(data.user.id);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as any;
          const sender = participants.find((p) => p.user_id === m.sender_id);
          setMessages((prev) => [
            ...prev,
            {
              id: m.id,
              sender_id: m.sender_id,
              content: m.content,
              attachment_url: m.attachment_url,
              attachment_name: m.attachment_name,
              attachment_size_kb: m.attachment_size_kb,
              created_at: m.created_at,
              senderName: sender ? [sender.first_name, sender.last_name].filter(Boolean).join(" ") || "Student" : "Student",
            },
          ]);
          if (userId) await markRead(userId);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
        () => {
          if (userId) loadConversation(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, participants, userId]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (pickerOpen && pickerTab === "gif" && gifResults.length === 0 && !gifLoading) {
      searchGifs("trending");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, pickerTab]);

  async function loadConversation(uid: string) {
    if (!conversationId) {
      alert("Couldn't open this chat: no conversation ID in the URL.");
      router.push("/messages");
      return;
    }

    const { data: conv, error } = await supabase
      .from("conversations")
      .select("id, type, name, avatar_url, announcement")
      .eq("id", conversationId)
      .single();

    if (error || !conv) {
      alert("Couldn't load conversation: " + (error?.message ?? "not found"));
      router.push("/messages");
      return;
    }

    setConvType(conv.type);
    setAnnouncement(conv.announcement);

    const { data: parts, error: partsErr } = await supabase
      .from("conversation_participants")
      .select("user_id, last_read_at, profiles(first_name, last_name, avatar_url, last_seen_at)")
      .eq("conversation_id", conversationId);

    if (partsErr) {
      console.error(partsErr);
      return;
    }

    const mappedParts: Participant[] = (parts ?? []).map((p: any) => ({
      user_id: p.user_id,
      first_name: p.profiles?.first_name ?? null,
      last_name: p.profiles?.last_name ?? null,
      avatar_url: p.profiles?.avatar_url ?? null,
      last_seen_at: p.profiles?.last_seen_at ?? null,
      last_read_at: p.last_read_at ?? null,
    }));
    setParticipants(mappedParts);

    if (conv.type === "direct") {
      const other = mappedParts.find((p) => p.user_id !== uid) ?? null;
      setOtherUser(other);
      setConvName(other ? [other.first_name, other.last_name].filter(Boolean).join(" ") || "Student" : "Student");
      setConvAvatar(other?.avatar_url ?? null);
    } else {
      setConvName(conv.name || "Group");
      setConvAvatar(conv.avatar_url);
    }
  }

  async function loadMessages() {
    if (!conversationId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, attachment_url, attachment_name, attachment_size_kb, created_at, profiles(first_name, last_name)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      alert("Load messages failed: " + error.message);
      return;
    }

    const mapped: Msg[] = (data ?? []).map((m: any) => ({
      id: m.id,
      sender_id: m.sender_id,
      content: m.content,
      attachment_url: m.attachment_url,
      attachment_name: m.attachment_name,
      attachment_size_kb: m.attachment_size_kb,
      created_at: m.created_at,
      senderName: [m.profiles?.first_name, m.profiles?.last_name].filter(Boolean).join(" ") || "Student",
    }));
    setMessages(mapped);

    const ids = mapped.map((m) => m.id);
    if (ids.length > 0) {
      const { data: reactions } = await supabase.from("message_reactions").select("message_id, emoji, user_id").in("message_id", ids);
      const grouped: Record<string, { emoji: string; user_id: string }[]> = {};
      (reactions ?? []).forEach((r: any) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
      });
      setReactionsByMsg(grouped);
    }

    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  }

  async function markRead(uid: string) {
    if (!conversationId) return;
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", uid);
  }

  async function sendMessage() {
    if (!userId || !draft.trim() || !conversationId) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: userId, content: text });
    setSending(false);
    if (error) {
      alert("Send failed: " + error.message);
      setDraft(text);
    }
  }

  async function sendAttachment(file: File) {
    if (!userId || !conversationId) return;
    setAttaching(true);
    const path = `${conversationId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("message-attachments").upload(path, file);
    if (upErr) {
      alert("Attachment upload failed: " + upErr.message);
      setAttaching(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("message-attachments").getPublicUrl(path);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      attachment_url: urlData.publicUrl,
      attachment_name: file.name,
      attachment_size_kb: Math.round(file.size / 1024),
    });
    setAttaching(false);
    if (error) alert("Send failed: " + error.message);
  }

  async function sendGif(url: string) {
    if (!userId || !conversationId) return;
    setPickerOpen(false);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      attachment_url: url,
      attachment_name: "gif.gif",
    });
    if (error) alert("Send failed: " + error.message);
  }

  async function searchGifs(q: string) {
    setGifQuery(q === "trending" ? "" : q);
    setGifLoading(true);
    try {
      const res = await fetch(`/api/tenor/search?q=${encodeURIComponent(q || "trending")}`);
      const data = await res.json();
      setGifResults(data.gifs ?? []);
    } catch {
      setGifResults([]);
    }
    setGifLoading(false);
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
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Couldn't access your microphone. Check site permissions and try again.");
    }
  }

  function stopRecordingAndDiscard() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);
    audioChunksRef.current = [];
  }

  async function stopRecordingAndSend() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !userId || !conversationId) return;

    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
    });
    recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);

    const blob = await stopped;
    if (blob.size === 0) return;

    setAttaching(true);
    const fileName = `voice-${Date.now()}.webm`;
    const path = `${conversationId}/${fileName}`;
    const { error: upErr } = await supabase.storage.from("message-attachments").upload(path, blob, { contentType: "audio/webm" });
    if (upErr) {
      alert("Voice note upload failed: " + upErr.message);
      setAttaching(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("message-attachments").getPublicUrl(path);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      attachment_url: urlData.publicUrl,
      attachment_name: fileName,
      attachment_size_kb: Math.round(blob.size / 1024),
    });
    setAttaching(false);
    if (error) alert("Send failed: " + error.message);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!userId) return;
    const existing = (reactionsByMsg[messageId] || []).find((r) => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
    const { data } = await supabase.from("message_reactions").select("message_id, emoji, user_id").eq("message_id", messageId);
    setReactionsByMsg((prev) => ({ ...prev, [messageId]: (data ?? []).map((r: any) => ({ emoji: r.emoji, user_id: r.user_id })) }));
    setReactionPickerFor(null);
  }

  function groupedReactionSummary(messageId: string) {
    const list = reactionsByMsg[messageId] || [];
    const counts: Record<string, number> = {};
    list.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });
    return Object.entries(counts);
  }

  function readStatus(messageCreatedAt: string): "sent" | "read" {
    const others = participants.filter((p) => p.user_id !== userId);
    if (others.length === 0) return "sent";
    const allRead = others.every((p) => p.last_read_at && new Date(p.last_read_at) >= new Date(messageCreatedAt));
    return allRead ? "read" : "sent";
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  const onlineCount = convType === "group" ? participants.filter((p) => isOnline(p.last_seen_at)).length : 0;

  let lastDay = "";

  return (
    <main className="flex h-screen flex-col bg-hub-bg">
      <div className="flex items-center gap-3 border-b border-hub-border px-4 py-3">
        <button onClick={() => router.push("/messages")} className="text-white">
          <BackIcon />
        </button>
        <div className="relative h-9 w-9 shrink-0">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
            {convAvatar ? <img src={convAvatar} alt="" className="h-full w-full object-cover" /> : convName.charAt(0).toUpperCase()}
          </div>
          {convType === "direct" && isOnline(otherUser?.last_seen_at ?? null) && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-hub-bg bg-green-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{convName}</p>
          <p className="truncate text-[11px] text-hub-textDim">
            {convType === "group"
              ? `${participants.length} members${onlineCount > 0 ? `, ${onlineCount} online` : ""}`
              : isOnline(otherUser?.last_seen_at ?? null)
              ? "Online"
              : "Offline"}
          </p>
        </div>
        <button onClick={() => alert("Voice and video calling are coming in a future update.")} className="text-hub-textDim">
          <PhoneIcon />
        </button>
        <button onClick={() => setInfoOpen(true)} className="text-hub-textDim">
          <InfoIcon />
        </button>
      </div>

      {announcement && (
        <button className="flex items-start gap-3 border-b border-hub-border bg-hub-card px-4 py-3 text-left">
          <MegaphoneIcon />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-hub-accentLight">Announcements</p>
            <p className="mt-0.5 truncate text-xs text-white/90">{announcement}</p>
          </div>
          <ChevronIcon />
        </button>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const showDay = dayLabel(m.created_at) !== lastDay;
          lastDay = dayLabel(m.created_at);
          const isMine = m.sender_id === userId;
          const reactions = groupedReactionSummary(m.id);
          const isAudio = isAudioAttachment(m.attachment_name);
          const isImage = isImageAttachment(m.attachment_name);

          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-hub-card px-3 py-1 text-[11px] text-hub-textDim">{dayLabel(m.created_at)}</span>
                </div>
              )}
              <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                <div className={`max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                  {convType === "group" && !isMine && (
                    <p className={`mb-0.5 px-1 text-xs font-semibold ${colorForSender(m.sender_id)}`}>{m.senderName}</p>
                  )}
                  <button
                    onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                    className={`relative rounded-2xl px-3.5 py-2.5 text-left text-sm ${
                      isImage
                        ? "p-1"
                        : isMine
                        ? "bg-hub-accentLight text-white"
                        : "bg-hub-card text-white/90 border border-hub-border"
                    }`}
                  >
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                    {m.attachment_url && isAudio && <VoiceNotePlayer url={m.attachment_url} isMine={isMine} />}
                    {m.attachment_url && isImage && (
                      <img src={m.attachment_url} alt="" className="max-h-64 rounded-xl object-contain" />
                    )}
                    {m.attachment_url && !isAudio && !isImage && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2"
                      >
                        <FileIcon />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{m.attachment_name}</span>
                          {m.attachment_size_kb && (
                            <span className="block text-[10px] opacity-70">{(m.attachment_size_kb / 1024).toFixed(1)} MB</span>
                          )}
                        </span>
                      </a>
                    )}
                  </button>

                  {reactions.length > 0 && (
                    <div className={`-mt-1.5 flex gap-1 ${isMine ? "mr-1" : "ml-1"}`}>
                      {reactions.map(([emoji, count]) => (
                        <span key={emoji} className="flex items-center gap-0.5 rounded-full border border-hub-border bg-hub-card px-1.5 py-0.5 text-[10px] text-white">
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}

                  {reactionPickerFor === m.id && (
                    <div className="mt-1 flex gap-1 rounded-full border border-hub-border bg-hub-card2 px-2 py-1.5 shadow-lg">
                      {REACTION_SET.map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(m.id, emoji)} className="text-base active:scale-125">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className={`mt-0.5 flex items-center gap-1 px-1 text-[10px] text-hub-textDim ${isMine ? "flex-row-reverse" : ""}`}>
                    <span>{timeShort(m.created_at)}</span>
                    {isMine && (readStatus(m.created_at) === "read" ? <DoubleCheckIcon className="text-hub-accentLight" /> : <SingleCheckIcon />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="mt-10 text-center text-sm text-hub-textDim">No messages yet — say hello.</p>}
      </div>

      <div className="flex items-center gap-2 border-t border-hub-border px-4 py-3">
        {!recording && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={attaching}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hub-accentLight text-white disabled:opacity-50"
          >
            {attaching ? <span className="text-xs">...</span> : <PlusIcon />}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) sendAttachment(e.target.files[0]);
            e.target.value = "";
          }}
        />

        {recording ? (
          <div className="flex flex-1 items-center gap-3 rounded-full border border-red-400/40 bg-hub-card2 px-4 py-2.5">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="flex-1 text-sm text-white">{formatDuration(recordSeconds)}</span>
            <button onClick={stopRecordingAndDiscard} className="text-red-400">
              <TrashIcon />
            </button>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2 rounded-full border border-hub-border bg-hub-card2 px-4 py-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder="Message..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
            />
            <button onClick={() => setPickerOpen(true)} className="text-hub-textDim">
              <EmojiIcon />
            </button>
          </div>
        )}

        {recording ? (
          <button
            onClick={stopRecordingAndSend}
            disabled={attaching}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hub-accentLight text-white disabled:opacity-50"
          >
            <SendIcon />
          </button>
        ) : draft.trim() ? (
          <button onClick={sendMessage} disabled={sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hub-accentLight text-white disabled:opacity-50">
            <SendIcon />
          </button>
        ) : (
          <button onClick={startRecording} className="flex h-9 w-9 shrink-0 items-center justify-center text-hub-textDim">
            <MicIcon />
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setPickerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-hub-border bg-hub-card">
            <div className="flex items-center justify-between border-b border-hub-border px-4 py-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setPickerTab("emoji")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${pickerTab === "emoji" ? "bg-hub-accentLight text-white" : "text-hub-textDim"}`}
                >
                  Emoji
                </button>
                <button
                  onClick={() => setPickerTab("gif")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${pickerTab === "gif" ? "bg-hub-accentLight text-white" : "text-hub-textDim"}`}
                >
                  GIFs
                </button>
              </div>
              <button onClick={() => setPickerOpen(false)} className="text-hub-textDim">
                <CloseIcon />
              </button>
            </div>

            {pickerTab === "emoji" ? (
              <div className="overflow-y-auto">
                <EmojiPicker
                  data={emojiData}
                  onEmojiSelect={(emoji: any) => setDraft((prev) => prev + emoji.native)}
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="search"
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden p-3">
                <input
                  value={gifQuery}
                  onChange={(e) => searchGifs(e.target.value)}
                  placeholder="Search GIFs..."
                  className="rounded-full border border-hub-border bg-hub-card2 px-4 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
                <div className="mt-3 grid grid-cols-3 gap-1.5 overflow-y-auto">
                  {gifLoading && <p className="col-span-3 py-6 text-center text-sm text-hub-textDim">Loading...</p>}
                  {!gifLoading && gifResults.length === 0 && (
                    <p className="col-span-3 py-6 text-center text-sm text-hub-textDim">No GIFs found.</p>
                  )}
                  {gifResults.map((g) => (
                    <button key={g.id} onClick={() => sendGif(g.full)} className="aspect-square overflow-hidden rounded-lg bg-hub-card2">
                      <img src={g.preview} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {infoOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setInfoOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl border-t border-hub-border bg-hub-card p-5">
            <p className="text-sm font-semibold text-white">{convType === "group" ? "Members" : "About"}</p>
            <div className="mt-3 flex flex-col gap-3">
              {participants.map((p) => (
                <div key={p.user_id} className="flex items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.first_name?.charAt(0) ?? "U").toUpperCase()}
                    </div>
                    {isOnline(p.last_seen_at) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-hub-card bg-green-500" />}
                  </div>
                  <p className="text-sm text-white">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "Student"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.8 21 3 13.2 3 3.9c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11v6M12 8v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MegaphoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-hub-accentLight">
      <path d="M3 10v4a1 1 0 001 1h2l5 4V5L6 9H4a1 1 0 00-1 1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 8a4 4 0 010 8M18 5a8 8 0 010 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0 text-hub-textDim">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function EmojiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M8.5 14.5a4 4 0 007 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-8-6 16-3-7-7-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}
function SingleCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l5 5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="13" viewBox="0 0 28 24" fill="none" className={className}>
      <path d="M2 12l5 5L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 12l5 5L26 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
