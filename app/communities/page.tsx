"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Community = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
};

export default function CommunitiesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/auth");
        return;
      }
      setUserId(userData.user.id);

      let query = supabase
        .from("communities")
        .select("id, name, description, community_members(count)")
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }

      const { data } = await query;
      const mapped: Community[] = (data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        member_count: c.community_members?.[0]?.count ?? 0,
      }));
      setCommunities(mapped);

      const { data: memberships } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", userData.user.id);
      setJoinedIds(new Set((memberships ?? []).map((m) => m.community_id)));

      setLoading(false);
    }
    load();
  }, [search, router]);

  async function toggleJoin(communityId: string) {
    if (!userId) return;
    const isJoined = joinedIds.has(communityId);

    if (isJoined) {
      await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);
      setJoinedIds((prev) => {
        const next = new Set(prev);
        next.delete(communityId);
        return next;
      });
    } else {
      await supabase.from("community_members").insert({ community_id: communityId, user_id: userId });
      setJoinedIds((prev) => new Set(prev).add(communityId));
    }
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold">Communities</h1>
          <p className="text-sm text-hub-textDim">Join and connect with people on campus.</p>
        </div>
      </div>

      <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-hub-border bg-hub-card2 px-4 py-3">
        <SearchIcon />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search communities..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-hub-textDim"
        />
      </div>

      <div className="mx-5 mt-6">
        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
          </div>
        ) : communities.length === 0 ? (
          <p className="mt-4 text-sm text-hub-textDim">No communities yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {communities.map((c) => (
              <CommunityRow
                key={c.id}
                community={c}
                isJoined={joinedIds.has(c.id)}
                onToggleJoin={() => toggleJoin(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-5 right-5">
        <button
          onClick={() => router.push("/communities/create")}
          className="w-full rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white"
        >
          + Create Community
        </button>
      </div>

      <BottomNav />
    </main>
  );
}

function CommunityRow({
  community,
  isJoined,
  onToggleJoin,
}: {
  community: Community;
  isJoined: boolean;
  onToggleJoin: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-card p-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hub-card2 text-hub-accentLight">
        <UsersIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{community.name}</p>
        <p className="truncate text-xs text-hub-textDim">
          {community.member_count} member{community.member_count === 1 ? "" : "s"}
        </p>
      </div>
      <button
        onClick={onToggleJoin}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
          isJoined ? "border border-hub-border text-hub-textDim" : "bg-hub-accent text-white"
        }`}
      >
        {isJoined ? "Joined" : "Join"}
      </button>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-hub-textDim shrink-0">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 19c1-3.2 4-4.5 6.5-4.5s5.5 1.3 6.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 14.2c2 .3 3.7 1.5 4.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
