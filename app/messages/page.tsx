"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Row = {
  conversationId: string;
  type: "direct" | "group";
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageMine: boolean;
  lastMessageAt: string | null;
  pinned: boolean;
  muted: boolean;
  unreadCount: number;
  status: "accepted" | "pending";
  otherUserId: string | null;
  otherUserOnline: boolean;
};

type TabKey = "All" | "Unread" | "Groups" | "Requests";
const tabs: TabKey[] = ["All", "Unread", "Groups", "Requests"];

function timeShort(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (daysAgo < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; username: string | null; avatar_url: string | null }[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
      await loadConversations(data.user.id);
      setLoading(false);
    }
    init();
    const heartbeat = setInterval(() => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
      });
    }, 60000);
    return () => clearInterval(heartbeat);
  }, [router]);

  async function loadConversations(uid: string) {
    const { data: myParticipation, error } = await supabase
      .from("conversation_participants")
      .select("conversation_id, status, pinned, muted, last_read_at")
      .eq("user_id", uid);

    if (error) {
      console.error(error);
      alert("Load conversations failed: " + error.message);
      return;
    }
    if (!myParticipation || myParticipation.length === 0) {
      setRows([]);
      return;
    }

    const convIds = myParticipation.map((p) => p.conversation_id);

    const [{ data: convs }, { data: allParticipants }, { data: lastMessages }] = await Promise.all([
      supabase.from("conversations").select("id, type, name, avatar_url").in("id", convIds),
      supabase
        .from("conversation_participants")
        .select("conversation_id, user_id, profiles(id, first_name, last_name, avatar_url, last_seen_at)")
        .in("conversation_id", convIds),
      supabase
        .from("messages")
        .select("conversation_id, content, attachment_name, sender_id, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false }),
    ]);

    // count unread: messages after my last_read_at, not sent by me
    const myReadMap: Record<string, string> = {};
    myParticipation.forEach((p) => {
      myReadMap[p.conversation_id] = p.last_read_at;
    });

    const { data: allMessagesForUnread } = await supabase
      .from("messages")
      .select("conversation_id, sender_id, created_at")
      .in("conversation_id", convIds);

    const unreadCounts: Record<string, number> = {};
    (allMessagesForUnread ?? []).forEach((m: any) => {
      if (m.sender_id === uid) return;
      const readAt = myReadMap[m.conversation_id];
      if (!readAt || new Date(m.created_at) > new Date(readAt)) {
        unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
      }
    });

    const lastMsgByConv: Record<string, any> = {};
    (lastMessages ?? []).forEach((m: any) => {
      if (!lastMsgByConv[m.conversation_id]) lastMsgByConv[m.conversation_id] = m;
    });

    const mapped: Row[] = myParticipation.map((p) => {
      const conv = (convs ?? []).find((c: any) => c.id === p.conversation_id);
      const others = (allParticipants ?? []).filter((ap: any) => ap.conversation_id === p.conversation_id && ap.user_id !== uid);
      const lastMsg = lastMsgByConv[p.conversation_id];

      let name = conv?.name ?? "Conversation";
      let avatarUrl = conv?.avatar_url ?? null;
      let otherUserId: string | null = null;
      let otherUserOnline = false;

      if (conv?.type === "direct" && others[0]) {
        const other = others[0].profiles as any;
        name = [other?.first_name, other?.last_name].filter(Boolean).join(" ") || "Student";
        avatarUrl = other?.avatar_url ?? null;
        otherUserId = other?.id ?? null;
        otherUserOnline = isOnline(other?.last_seen_at ?? null);
      }

      return {
        conversationId: p.conversation_id,
        type: conv?.type ?? "direct",
        name,
        avatarUrl,
        lastMessage: lastMsg ? (lastMsg.content || (lastMsg.attachment_name ? `📎 ${lastMsg.attachment_name}` : "")) : null,
        lastMessageMine: lastMsg ? lastMsg.sender_id === uid : false,
        lastMessageAt: lastMsg ? lastMsg.created_at : null,
        pinned: p.pinned,
        muted: p.muted,
        unreadCount: unreadCounts[p.conversation_id] || 0,
        status: p.status,
        otherUserId,
        otherUserOnline,
      };
    });

    mapped.sort((a, b) => {
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });

    setRows(mapped);
  }

  async function acceptRequest(conversationId: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("conversation_participants")
      .update({ status: "accepted" })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) {
      alert("Accept failed: " + error.message);
      return;
    }
    if (userId) await loadConversations(userId);
  }

  async function declineRequest(conversationId: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) {
      alert("Decline failed: " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.conversationId !== conversationId));
  }

  async function runSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, username, avatar_url")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq("id", userId ?? "")
      .limit(15);
    if (error) {
      console.error(error);
      return;
    }
    setSearchResults(
      (data ?? []).map((u: any) => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "Student",
        username: u.username,
        avatar_url: u.avatar_url,
      }))
    );
  }

  async function startConversationWith(otherUserId: string) {
    if (!userId || starting) return;
    setStarting(true);

    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", userId);
    const { data: theirs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", otherUserId);
    const mineIds = new Set((mine ?? []).map((r: any) => r.conversation_id));
    const shared = (theirs ?? []).find((r: any) => mineIds.has(r.conversation_id));

    if (shared) {
      const { data: conv } = await supabase.from("conversations").select("id, type").eq("id", shared.conversation_id).single();
      if (conv?.type === "direct") {
        setStarting(false);
        setSearchOpen(false);
        router.push(`/messages/${shared.conversation_id}`);
        return;
      }
    }

    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({ type: "direct", created_by: userId })
      .select("id")
      .single();

    if (convErr || !newConv) {
      alert("Couldn't start conversation: " + (convErr?.message ?? "unknown error"));
      setStarting(false);
      return;
    }

    const { error: partErr } = await supabase.from("conversation_participants").insert([
      { conversation_id: newConv.id, user_id: userId, status: "accepted" },
      { conversation_id: newConv.id, user_id: otherUserId, status: "pending" },
    ]);

    setStarting(false);
    if (partErr) {
      alert("Couldn't add participants: " + partErr.message);
      return;
    }

    setSearchOpen(false);
    router.push(`/messages/${newConv.id}`);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  const unreadTotal = rows.reduce((sum, r) => sum + (r.status === "accepted" && r.unreadCount > 0 ? 1 : 0), 0);
  const groupsTotal = rows.filter((r) => r.type === "group" && r.status === "accepted").length;
  const requestsTotal = rows.filter((r) => r.status === "pending").length;

  let visibleRows = rows.filter((r) => r.status === "accepted");
  if (activeTab === "Unread") visibleRows = visibleRows.filter((r) => r.unreadCount > 0);
  if (activeTab === "Groups") visibleRows = visibleRows.filter((r) => r.type === "group");
  if (activeTab === "Requests") visibleRows = rows.filter((r) => r.status === "pending");

  const pinnedRows = activeTab === "All" ? visibleRows.filter((r) => r.pinned) : [];
  const recentRows = activeTab === "All" ? visibleRows.filter((r) => !r.pinned) : visibleRows;

  function renderRow(r: Row) {
    return (
      <button
        key={r.conversationId}
        onClick={() => router.push(`/messages/${r.conversationId}`)}
        className="flex w-full items-center gap-3 border-b border-hub-border px-5 py-3 text-left"
      >
        <div className="relative h-12 w-12 shrink-0">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-sm font-medium text-white">
            {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" /> : r.name.charAt(0).toUpperCase()}
          </div>
          {r.type === "direct" && r.otherUserOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-hub-bg bg-green-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm ${r.unreadCount > 0 ? "font-semibold text-white" : "font-medium text-white"}`}>{r.name}</p>
            <span className="shrink-0 text-[11px] text-hub-textDim">{r.lastMessageAt ? timeShort(r.lastMessageAt) : ""}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className={`truncate text-xs ${r.unreadCount > 0 ? "text-white/80" : "text-hub-textDim"}`}>
              {r.lastMessage ? `${r.lastMessageMine ? "You: " : ""}${r.lastMessage}` : "No messages yet"}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {r.muted && <MuteIcon />}
              {r.unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-hub-accentLight px-1.5 text-[10px] font-semibold text-white">
                  {r.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Messages</h1>
          <p className="mt-0.5 text-xs text-hub-textDim">Chat with friends and communities.</p>
        </div>
        <div className="flex items-center gap-3 text-hub-textDim">
          <SearchIcon />
          <button onClick={() => setSearchOpen(true)}>
            <ComposeIcon />
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const count = tab === "Unread" ? unreadTotal : tab === "Groups" ? groupsTotal : tab === "Requests" ? requestsTotal : 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium ${
                activeTab === tab ? "bg-hub-accentLight text-white" : "border border-hub-border text-hub-textDim"
              }`}
            >
              {tab}
              {count > 0 && (
                <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${activeTab === tab ? "bg-white/25" : "bg-hub-card2"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "All" && pinnedRows.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between px-5">
            <h2 className="text-sm font-medium text-hub-textDim">Pinned</h2>
          </div>
          <div className="mt-2">{pinnedRows.map(renderRow)}</div>
        </div>
      )}

      <div className="mt-4">
        {activeTab === "All" && <h2 className="px-5 text-sm font-medium text-hub-textDim">Recent</h2>}
        <div className="mt-2">
          {visibleRows.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-hub-textDim">
              {activeTab === "Requests" ? "No message requests." : "No conversations yet."}
            </p>
          )}
          {activeTab === "Requests"
            ? recentRows.map((r) => (
                <div key={r.conversationId} className="flex items-center gap-3 border-b border-hub-border px-5 py-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-sm font-medium text-white">
                    {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" /> : r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{r.name}</p>
                    <p className="truncate text-xs text-hub-textDim">{r.lastMessage ?? "Wants to message you"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => declineRequest(r.conversationId)} className="rounded-lg border border-hub-border px-3 py-1.5 text-xs text-white">
                      Decline
                    </button>
                    <button onClick={() => acceptRequest(r.conversationId)} className="rounded-lg bg-hub-accentLight px-3 py-1.5 text-xs font-medium text-white">
                      Accept
                    </button>
                  </div>
                </div>
              ))
            : recentRows.map(renderRow)}
        </div>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-hub-bg">
          <div className="flex items-center gap-3 border-b border-hub-border px-5 py-4">
            <button onClick={() => setSearchOpen(false)} className="text-white">
              <BackIcon />
            </button>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Search people..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-hub-textDim outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchQuery.trim() && searchResults.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-hub-textDim">No students found.</p>
            )}
            {searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => startConversationWith(u.id)}
                disabled={starting}
                className="flex w-full items-center gap-3 border-b border-hub-border px-5 py-3 text-left disabled:opacity-50"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-sm font-medium text-white">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{u.name}</p>
                  {u.username && <p className="truncate text-xs text-hub-textDim">@{u.username}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ComposeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MuteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-hub-textDim">
      <path d="M11 5L6 9H3v6h3l5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M22 9l-6 6M16 9l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
