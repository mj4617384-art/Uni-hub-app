"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Subscription = {
  status: string;
  expires_at: string;
  amount_paid: number | null;
};

type Listing = {
  id: string;
  title: string;
  price: number;
  image_urls: string[] | null;
  status: string;
  views_count: number;
  boosted_until: string | null;
  auto_relist: boolean;
};

export default function SellerDashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [boostingId, setBoostingId] = useState<string | null>(null);

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
        .select("first_name, avatar_url")
        .eq("id", data.user.id)
        .single();
      setFirstName(profile?.first_name ?? null);
      setAvatarUrl(profile?.avatar_url ?? null);

      const { data: subData } = await supabase
        .from("seller_subscriptions")
        .select("status, expires_at, amount_paid")
        .eq("user_id", data.user.id)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subData || new Date(subData.expires_at) < new Date()) {
        router.push("/marketplace/upgrade");
        return;
      }
      setSub(subData);

      const { data: listingsData } = await supabase
        .from("marketplace_items")
        .select("id, title, price, image_urls, status, views_count, boosted_until, auto_relist")
        .eq("seller_id", data.user.id)
        .order("created_at", { ascending: false });
      setListings(listingsData ?? []);

      const { count: orderCount } = await supabase
        .from("marketplace_orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", data.user.id);
      setOrdersCount(orderCount ?? 0);

      const { data: paidOrders } = await supabase
        .from("marketplace_orders")
        .select("amount")
        .eq("seller_id", data.user.id)
        .eq("status", "paid");
      setRevenue((paidOrders ?? []).reduce((sum, o: any) => sum + Number(o.amount), 0));

      setLoading(false);
    }
    init();
  }, [router]);

  async function boostListing(itemId: string) {
    setBoostingId(itemId);
    const boostedUntil = new Date();
    boostedUntil.setDate(boostedUntil.getDate() + 7);
    const { error } = await supabase
      .from("marketplace_items")
      .update({ boosted_until: boostedUntil.toISOString() })
      .eq("id", itemId);
    setBoostingId(null);
    if (error) {
      alert("Boost failed: " + error.message);
      return;
    }
    setListings((prev) => prev.map((l) => (l.id === itemId ? { ...l, boosted_until: boostedUntil.toISOString() } : l)));
  }

  async function toggleAutoRelist(itemId: string, current: boolean) {
    const { error } = await supabase
      .from("marketplace_items")
      .update({ auto_relist: !current })
      .eq("id", itemId);
    if (error) {
      alert("Update failed: " + error.message);
      return;
    }
    setListings((prev) => prev.map((l) => (l.id === itemId ? { ...l, auto_relist: !current } : l)));
  }

  const totalViews = listings.reduce((sum, l) => sum + (l.views_count ?? 0), 0);

  if (loading || !sub) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pb-16 pt-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-sm font-medium text-white">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (firstName?.charAt(0).toUpperCase() ?? "U")}
          </div>
          <div>
            <p className="text-xs text-hub-textDim">Welcome back,</p>
            <p className="text-sm font-semibold text-white">{firstName ?? "Seller"} <span className="text-hub-accentLight">✓</span></p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-yellow-400/10 border border-yellow-400/40 px-2.5 py-1 text-xs font-medium text-yellow-400">
          👑 Pro
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-hub-border bg-hub-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Seller Pro</p>
          <span className="rounded-full bg-green-500/10 border border-green-500/40 px-2 py-0.5 text-[10px] text-green-400">Active</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-hub-textDim">
          <span>Valid until {new Date(sub.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          <span>Amount Paid ₦{Number(sub.amount_paid ?? 0).toLocaleString()}</span>
        </div>
      </div>

      <p className="mt-5 text-sm font-medium text-hub-textDim">Pro Dashboard</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <StatCard label="Views" value={totalViews.toLocaleString()} />
        <StatCard label="Orders" value={ordersCount.toLocaleString()} />
        <StatCard label="Revenue" value={`₦${revenue.toLocaleString()}`} />
        <StatCard label="Listings" value={listings.length.toString()} />
      </div>

      <p className="mt-5 text-sm font-medium text-hub-textDim">Your Listings</p>
      <div className="mt-2 flex flex-col gap-2">
        {listings.length === 0 && <p className="text-sm text-hub-textDim">No listings yet.</p>}
        {listings.map((l) => {
          const boosted = l.boosted_until && new Date(l.boosted_until) > new Date();
          return (
            <div key={l.id} className="rounded-xl border border-hub-border bg-hub-card p-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-hub-card2">
                  {l.image_urls?.[0] && <img src={l.image_urls[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{l.title}</p>
                  <p className="text-xs text-hub-accentLight">₦{Number(l.price).toLocaleString()}</p>
                  <p className="text-[11px] text-hub-textDim">{l.views_count} views {boosted ? "· Boosted" : ""}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => boostListing(l.id)}
                  disabled={boostingId === l.id || !!boosted}
                  className="rounded-lg border border-hub-border px-2.5 py-1 text-[11px] text-white disabled:opacity-40"
                >
                  {boosted ? "Boosted" : boostingId === l.id ? "Boosting..." : "Boost (7 days)"}
                </button>
                <button
                  onClick={() => toggleAutoRelist(l.id, l.auto_relist)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] ${l.auto_relist ? "border-hub-accentLight text-hub-accentLight" : "border-hub-border text-white"}`}
                >
                  Auto Relist: {l.auto_relist ? "On" : "Off"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hub-border bg-hub-card p-3">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[11px] text-hub-textDim">{label}</p>
    </div>
  );
}
