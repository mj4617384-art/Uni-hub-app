"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CommunityTab = "Chat" | "Posts" | "Files" | "Members";
const TABS: CommunityTab[] = ["Chat", "Posts", "Files", "Members"];

type Community = {
  id: string;
  name: string;
  photo_url: string | null;
  icon_key: string | null;
  category: string | null;
};

type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  first_name?: string;
};

const ICON_EMOJI: Record<string, string> = {
  academic: "🎓",
  tech: "💻",
  sports: "⚽",
  gaming: "🎮",
};

export default function CommunityGroupPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [community, setCommunity] = useState<Community | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [activeTab, setActiveTab] = useState<CommunityTab>("Chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/auth");
        return;
      }
      setUserId(userData.user.id);

      const { data: c, error: cErr } = await supabase
        .from("communities")
        .select("id, name, photo_url, icon_key, category")
        .eq("id", communityId)
        .single();

      if (cErr || !c) {
        setLoading(false);
        return;
      }
      setCommunity(c);

      const { count } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId);
      setMemberCount(count ?? 0);

      const { data: membership } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      setIsMember(!!membership);

      setLoading(false);
    }
    if (communityId) init();
  }, [communityId, router]);

  useEffect(() => {
    if (activeTab === "Chat" && isMember && communityId) loadMessages();
  }, [activeTab, isMember, communityId]);

  useEffect(() => {
    if (!isMember || !communityId) return;
    const channel = supabase
      .channel(`community_messages:${communityId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${communityId}` },
        async (payload) => {
          const row: any = payload.new;
          const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", row.user_id).single();
          setMessages((prev) => [...prev, { ...row, first_name: profile?.first_name ?? "Student" }]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMember, communityId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function loadMessages() {
    setMessagesLoading(true);
    const { data, error } = await supabase
      .from("community_messages")
      .select("id, user_id, content, created_at, profiles(first_name)")
      .eq("community_id", communityId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      console.error(error);
      setMessagesLoading(false);
      return;
    }
    setMessages((data ?? []).map((m: any) => ({ ...m, first_name: m.profiles?.first_name ?? "Student" })));
    setMessagesLoading(false);
  }

  async function sendMessage() {
    if (!userId || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    const { error } = await supabase.from("community_messages").insert({
      community_id: communityId,
      user_id: userId,
      content: text,
    });
    setSending(false);
    if (error) {
      alert("Message failed: " + error.message);
      setDraft(text);
    }
  }

  async function joinCommunity() {
    if (!userId) return;
    const { error } = await supabase.from("community_members").insert({
      community_id: communityId,
      user_id: userId,
      role: "member",
    });
    if (!error) {
      setIsMember(true);
      setMemberCount((c) => c + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-hub-bg px-6 text-center">
        <p className="text-sm text-white/90">Community not found</p>
        <button onClick={() => router.push("/communities")} className="text-sm text-hub-accentLight">
          Back to Communities
        </button>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-hub-bg">
      <div className="flex items-center gap-3 border-b border-hub-border px-5 py-4">
        <button onClick={() => router.back()} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-hub-card2 text-lg">
          {community.photo_url ? (
            <img src={community.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            ICON_EMOJI[community.icon_key ?? ""] ?? "👥"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{community.name}</p>
          <p className="text-xs text-hub-textDim">{memberCount} member{memberCount === 1 ? "" : "s"}</p>
        </div>
      </div>

      {!isMember ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-hub-card2 text-3xl">
            {community.photo_url ? (
              <img src={community.photo_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              ICON_EMOJI[community.icon_key ?? ""] ?? "👥"
            )}
          </div>
          <p className="text-base font-semibold text-white">{community.name}</p>
          {community.category && <p className="text-xs text-hub-textDim">{community.category}</p>}
          <button onClick={joinCommunity} className="rounded-xl bg-hub-accent px-6 py-3 text-sm font-medium text-white">
            Join Community
          </button>
        </div>
      ) : (
        <>
          <div className="flex border-b border-hub-border px-5">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-6 pb-2.5 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === tab ? "border-hub-accentLight text-white" : "border-transparent text-hub-textDim"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Chat" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                {messagesLoading && <p className="text-center text-sm text-hub-textDim">Loading...</p>}
                {!messagesLoading && messages.length === 0 && (
                  <p className="mt-10 text-center text-sm text-hub-textDim">No messages yet. Say hello 👋</p>
                )}
                <div className="flex flex-col gap-2.5">
                  {messages.map((m) => {
                    const isMine = m.user_id === userId;
                    return (
                      <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isMine ? "bg-hub-accent text-white" : "bg-hub-card2 text-white"}`}>
                          {!isMine && <p className="mb-0.5 text-[11px] font-medium text-hub-accentLight">{m.first_name}</p>}
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-hub-border px-3 py-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                  placeholder="Message..."
                  className="flex-1 rounded-full border border-hub-border bg-hub-card2 px-4 py-2.5 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !draft.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hub-accent text-white disabled:opacity-40"
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          )}

          {activeTab === "Posts" && (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm text-white/90">Posts are coming back soon</p>
                <p className="mt-1 text-xs text-hub-textDim">We're building this in the next step.</p>
              </div>
            </div>
          )}

          {activeTab === "Files" && (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm text-white/90">Files are coming back soon</p>
                <p className="mt-1 text-xs text-hub-textDim">We're building this in the next step.</p>
              </div>
            </div>
          )}

          {activeTab === "Members" && (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm text-white/90">Members are coming back soon</p>
                <p className="mt-1 text-xs text-hub-textDim">We're building this in the next step.</p>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 12 21 3l-6 18-4-8-8-1Z" />
    </svg>
  );
}
