"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];
const EMOJI_GRID = [
  "😀", "😂", "🥰", "😍", "😎", "🤔", "😢", "😡", "👍", "👎", "🙏", "🔥",
  "🎉", "❤️", "💯", "👏", "🙌", "😴", "🤯", "😭", "🥳", "🤝", "✅", "❌",
  "⚡", "⭐", "💀", "👀", "🤗", "😅", "😇", "🤣", "😜", "🙄", "😬", "🥺",
  "😤", "🤩", "😱", "🫡", "🙏🏾", "💪", "🎓", "📚", "☕", "🏆", "🎯", "🚀",
];

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
  const conversationId = params?.id as string;

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
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [viewportHeight, setViewportHeight] = useState<string>("100dvh");

  useEffect(() => {
    function updateHeight() {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      }
    }
    updateHeight();
    window.visualViewport?.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("scroll", updateHeight);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("scroll", updateHeight);
    };
  }, []);

  useEffect(() => {
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

  async function loadConversation(uid: string) {
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
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", uid);
  }

  async function sendMessage() {
    if (!userId || !draft.trim()) return;
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
    if (!userId) return;
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
    if (!recorder || !userId) return;

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
    <main className="flex flex-col bg-hub-bg" style={{ height: viewportHeight }}>
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

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundColor: "#0A0F1E",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.2' opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3Cpath d='M100 20 L100 45 M88 32 L112 32'/%3E%3Crect x='150' y='140' width='20' height='16' rx='2'/%3E%3Ccircle cx='60' cy='150' r='6'/%3E%3Cpath d='M20 160 Q30 150 40 160 Q50 170 60 160'/%3E%3Ctext x='140' y='60' font-size='18' fill='%23ffffff' stroke='none' opacity='0.7'%3E%CF%80%3C/text%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      >
        {messages.map((m) => {
          const showDay = dayLabel(m.created_at) !== lastDay;
          lastDay = dayLabel(m.created_at);
          const isMine = m.sender_id === userId;
          const reactions = groupedReactionSummary(m.id);
          const isAudio = isAudioAttachment(m.attachment_name);

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
                      isMine ? "bg-hub-accentLight text-white" : "bg-hub-card text-white/90 border border-hub-border"
                    }`}
                  >
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                    {m.attachment_url && isAudio && <VoiceNotePlayer url={m.attachment_url} isMine={isMine} />}
                    {m.attachment_url && !isAudio && (
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
            <button onClick={() => setEmojiPickerOpen(true)} className="text-hub-textDim">
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

      {emojiPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setEmojiPickerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl border-t border-hub-border bg-hub-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Emoji</p>
              <button onClick={() => setEmojiPickerOpen(false)} className="text-hub-textDim">
                <BackIcon />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_GRID.map((e) => (
                <button
                  key={e}
                  onClick={() => setDraft((prev) => prev + e)}
                  className="flex h-9 items-center justify-center text-2xl active:scale-110"
                >
                  {e}
                </button>
              ))}
            </div>
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
