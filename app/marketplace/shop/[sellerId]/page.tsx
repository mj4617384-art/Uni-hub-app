"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SellerProfile = {
  first_name: string | null;
  avatar_url: string | null;
  campus: string | null;
  created_at: string;
};

type Listing = {
  id: string;
  title: string;
  price: number;
  image_urls: string[] | null;
};

export default function ShopProfilePage() {
  const router = useRouter();
  const params = useParams();
  const sellerId = params.sellerId as string;

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMe, setIsMe] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      setIsMe(userData.user?.id === sellerId);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, campus, created_at")
        .eq("id", sellerId)
        .single();

      if (profileErr || !profile) {
        setError("Seller not found.");
        setLoading(false);
        return;
      }
      setSeller(profile);

      const { data: items } = await supabase
        .from("marketplace_items")
        .select("id, title, price, image_urls")
        .eq("seller_id", sellerId)
        .eq("status", "available")
        .order("created_at", { ascending: false });
      setListings(items ?? []);

      const { data: sub } = await supabase
        .from("seller_subscriptions")
        .select("expires_at")
        .eq("user_id", sellerId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub && new Date(sub.expires_at) > new Date()) setIsPro(true);

      setLoading(false);
    }
    load();
  }, [sellerId]);

  function messageSeller() {
    router.push(`/messages?seller=${sellerId}`);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-hub-bg px-6 text-center">
        <p className="text-sm text-red-400">{error ?? "Seller not found."}</p>
        <button onClick={() => router.push("/marketplace")} className="rounded-lg bg-hub-accentLight px-4 py-2 text-xs font-medium text-white">
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pb-16 pt-5">
      <button onClick={() => router.back()} aria-label="Back" className="text-white">
        <BackIcon />
      </button>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-hub-border bg-hub-card2 flex items-center justify-center text-lg font-semibold text-white">
          {seller.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            seller.first_name?.charAt(0).toUpperCase() ?? "U"
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-semibold text-white">{seller.first_name ?? "Student"}&apos;s Shop</h1>
            {isPro && <span className="text-yellow-400">👑</span>}
          </div>
          {seller.campus && <p className="text-xs text-hub-textDim">{seller.campus}</p>}
          <p className="text-[11px] text-hub-textDim">
            Joined {new Date(seller.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {!isMe && (
        <button
          onClick={messageSeller}
          className="mt-4 w-full rounded-xl border border-hub-border py-3 text-center text-sm font-medium text-white"
        >
          Message Seller
        </button>
      )}

      <p className="mt-6 text-sm font-medium text-hub-textDim">
        {listings.length} listing{listings.length === 1 ? "" : "s"}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {listings.length === 0 && <p className="col-span-2 text-sm text-hub-textDim">No active listings.</p>}
        {listings.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(`/marketplace/${item.id}`)}
            className="overflow-hidden rounded-xl border border-hub-border bg-hub-card text-left"
          >
            <div className="flex h-28 items-center justify-center bg-hub-card2">
              {item.image_urls?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_urls[0]} alt={item.title} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-2.5">
              <p className="truncate text-xs font-medium text-white">{item.title}</p>
              <p className="text-xs font-semibold text-hub-accentLight">₦{Number(item.price).toLocaleString()}</p>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
