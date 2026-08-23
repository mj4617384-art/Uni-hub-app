"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ConvoRow = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  other_name: string | null;
  other_avatar: string | null;
  unread: boolean;
};

const TABS = ["All", "Unread", "Groups", "Requests"] as const;
type Tab = (typeof TABS)[number];

function timeShort(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesListPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConvoRow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("All");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);
      await loadConversations(data.user.id);
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadConversations(uid: string) {
    const { data: myRows, error: myRowsErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", uid);

    if (myRowsErr) {
      console.error(myRowsErr);
      return;
    }

    const convIds = (myRows ?? []).map((r) => r.conversation_id);
    if (convIds.length === 0) {
      setConversations([]);
      return;
    }

    const readMap = new Map((myRows ?? []).map((r) => [r.conversation_id, r.last_read_at]));

    const { data: convos, error: convosErr } = await supabase
      .from("conversations")
      .select("id, type, name, avatar_url, last_message, last_message_at")
      .in("id", convIds)
      .order("last_message_at", { ascending: false });

    if (convosErr) {
      console.error(convosErr);
      return;
    }

    const result: ConvoRow[] = [];
    for (const c of convos ?? []) {
      let otherName: string | null = null;
      let otherAvatar: string | null = null;

      if (c.type === "direct") {
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("user_id, profiles(first_name, last_name, avatar_url)")
          .eq("conversation_id", c.id)
          .neq("user_id", uid)
          .maybeSingle();

        const prof = participants?.profiles as any;
        otherName = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(" ") || "Student" : "Student";
        otherAvatar = prof?.avatar_url ?? null;
      }

      const lastReadAt = readMap.get(c.id);
      const unread = !!c.last_message_at && (!lastReadAt || new Date(c.last_message_at) > new Date(lastReadAt));

      result.push({
        id: c.id,
        type: c.type,
        name: c.name,
        avatar_url: c.avatar_url,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        other_name: otherName,
        other_avatar: otherAvatar,
        unread,
      });
    }

    setConversations(result);
  }

  const filtered = conversations.filter((c) => {
    if (activeTab === "Unread") return c.unread;
    if (activeTab === "Groups") return c.type === "group";
    if (activeTab === "Requests") return false;
    return true;
  });

  const unreadCount = conversations.filter((c) => c.unread).length;
  const groupCount = conversations.filter((c) => c.type === "group").length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-24">
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Messages</h1>
            <p className="text-xs text-hub-textDim">Chat with friends and communities.</p>
          </div>
          <div className="flex items-center gap-4 text-hub-textDim">
            <SearchIcon />
            <EditIcon />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium ${
                activeTab === tab
                  ? "border-hub-accentLight bg-hub-accentLight text-white"
                  : "border-hub-border text-hub-textDim"
              }`}
            >
              {tab}
              {tab === "Unread" && unreadCount > 0 && ` ${unreadCount}`}
              {tab === "Groups" && groupCount > 0 && ` ${groupCount}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-5">
        <p className="text-sm font-medium text-hub-textDim">Recent</p>
      </div>

      {activeTab === "Requests" ? (
        <p className="mt-8 px-5 text-center text-sm text-hub-textDim">
          Message requests aren&apos;t available yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 px-5 text-center text-sm text-hub-textDim">
          {activeTab === "Unread" ? "No unread messages." : activeTab === "Groups" ? "No group chats yet." : "No conversations yet."}
        </p>
      ) : (
        <div className="mt-2 flex flex-col">
          {filtered.map((c) => {
            const displayName = c.type === "group" ? c.name || "Group" : c.other_name || "Student";
            const displayAvatar = c.type === "group" ? c.avatar_url : c.other_avatar;
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/messages/${c.id}`)}
                className="flex items-center gap-3 border-b border-hub-border px-5 py-3 text-left"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-sm font-medium text-white">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-hub-textDim">{c.last_message || "No messages yet"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-hub-textDim">{timeShort(c.last_message_at)}</span>
                  {c.unread && <span className="h-2.5 w-2.5 rounded-full bg-hub-accentLight" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
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
function EditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
