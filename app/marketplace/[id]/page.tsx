"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageLightbox from "@/components/ImageLightbox";

type ItemDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  image_urls: string[] | null;
  seller_id: string;
  status: string;
  views_count: number;
  seller_name?: string;
  seller_avatar?: string | null;
  seller_campus?: string | null;
};

export default function MarketplaceItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [ordering, setOrdering] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [inCart, setInCart] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);
  const [cartBusy, setCartBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      const { data, error: fetchErr } = await supabase
        .from("marketplace_items")
        .select("id, title, description, price, category, image_urls, seller_id, status, views_count, profiles(first_name, avatar_url, campus)")
        .eq("id", id)
        .single();

      if (fetchErr || !data) {
        setError("Listing not found.");
        setLoading(false);
        return;
      }

      const mapped: ItemDetail = {
        id: data.id,
        title: data.title,
        description: data.description,
        price: data.price,
        category: data.category,
        image_urls: data.image_urls,
        seller_id: data.seller_id,
        status: data.status,
        views_count: data.views_count ?? 0,
        seller_name: (data as any).profiles?.first_name ?? "Student",
        seller_avatar: (data as any).profiles?.avatar_url ?? null,
        seller_campus: (data as any).profiles?.campus ?? null,
      };
      setItem(mapped);
      setLoading(false);

      if (uid && uid !== data.seller_id) {
        // Log a deduped view — only counts once per viewer, ever
        const { data: viewRow } = await supabase
          .from("marketplace_item_views")
          .upsert({ item_id: id, viewer_id: uid }, { onConflict: "item_id,viewer_id", ignoreDuplicates: true })
          .select()
          .maybeSingle();

        if (viewRow) {
          await supabase
            .from("marketplace_items")
            .update({ views_count: (data.views_count ?? 0) + 1 })
            .eq("id", id);
        }

        const { data: cartRow } = await supabase
          .from("marketplace_cart_items")
          .select("id")
          .eq("user_id", uid)
          .eq("item_id", id)
          .maybeSingle();
        if (cartRow) {
          setInCart(true);
          setCartId(cartRow.id);
        }
      }
    }
    load();
  }, [id]);

  async function handleBuyNow() {
    if (!userId || !item) return;
    setOrdering(true);
    setOrderError(null);

    const { error: orderErr } = await supabase.from("marketplace_orders").insert({
      item_id: item.id,
      buyer_id: userId,
      seller_id: item.seller_id,
      amount: item.price,
      status: "pending",
    });

    setOrdering(false);
    if (orderErr) {
      setOrderError("Order failed: " + orderErr.message);
      return;
    }
    setOrderPlaced(true);
  }

  async function toggleCart() {
    if (!userId || !item) return;
    setCartBusy(true);

    if (inCart && cartId) {
      const { error } = await supabase.from("marketplace_cart_items").delete().eq("id", cartId);
      setCartBusy(false);
      if (error) {
        alert("Remove from cart failed: " + error.message);
        return;
      }
      setInCart(false);
      setCartId(null);
    } else {
      const { data, error } = await supabase
        .from("marketplace_cart_items")
        .insert({ user_id: userId, item_id: item.id })
        .select()
        .single();
      setCartBusy(false);
      if (error) {
        alert("Add to cart failed: " + error.message);
        return;
      }
      setInCart(true);
      setCartId(data.id);
    }
  }

  function messageSeller() {
    if (!item) return;
    router.push(`/messages?seller=${item.seller_id}`);
  }

  function visitShop() {
    if (!item) return;
    router.push(`/marketplace/shop/${item.seller_id}`);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-hub-bg px-6 text-center">
        <p className="text-sm text-red-400">{error ?? "Listing not found."}</p>
        <button onClick={() => router.push("/marketplace")} className="rounded-lg bg-hub-accentLight px-4 py-2 text-xs font-medium text-white">
          Back to Marketplace
        </button>
      </div>
    );
  }

  const isMine = userId === item.seller_id;
  const images = item.image_urls ?? [];

  return (
    <main className="min-h-screen bg-hub-bg pb-16">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back" className="text-white">
          <BackIcon />
        </button>
        <h1 className="text-lg font-semibold text-white">Listing</h1>
      </div>

      {images.length > 0 ? (
        <div className="mt-4 flex gap-1 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              className="h-64 w-full shrink-0 snap-center overflow-hidden rounded-xl bg-hub-card2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={item.title} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-5 mt-4 flex h-64 items-center justify-center rounded-xl bg-hub-card2 text-hub-textDim">
          <ImagePlaceholderIcon />
        </div>
      )}

      <div className="mx-5 mt-4">
        <p className="text-xs text-hub-textDim">{item.status === "available" ? "For Sale" : item.status}</p>
        <h2 className="mt-1 text-xl font-semibold text-white">{item.title}</h2>
        <p className="mt-1 text-lg font-semibold text-hub-accentLight">₦{Number(item.price).toLocaleString()}</p>
        <span className="mt-1 inline-block rounded-md border border-hub-border px-2 py-0.5 text-[11px] text-hub-textDim capitalize">
          {item.category}
        </span>
        <p className="mt-2 text-[11px] text-hub-textDim">{item.views_count} views</p>

        {item.description && (
          <p className="mt-3 text-sm text-white/90 whitespace-pre-wrap">{item.description}</p>
        )}

        <button
          onClick={visitShop}
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-hub-border bg-hub-card p-3 text-left"
        >
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white">
            {item.seller_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.seller_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              item.seller_name?.charAt(0).toUpperCase() ?? "U"
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{item.seller_name}</p>
            {item.seller_campus && <p className="text-[11px] text-hub-textDim">{item.seller_campus}</p>}
          </div>
          <span className="text-xs text-hub-accentLight">Visit Shop</span>
        </button>

        {isMine ? (
          <button
            onClick={() => router.push(`/marketplace/${item.id}/edit`)}
            className="mt-5 w-full rounded-xl border border-hub-border py-3.5 text-center text-sm font-medium text-white"
          >
            Edit Listing
          </button>
        ) : orderPlaced ? (
          <div className="mt-5 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center text-sm text-green-400">
            Order placed! The seller will reach out to arrange payment and pickup.
          </div>
        ) : (
          <>
            <div className="mt-5 flex gap-2">
              <button
                onClick={messageSeller}
                className="flex-1 rounded-xl border border-hub-border py-3.5 text-center text-sm font-medium text-white"
              >
                Message Seller
              </button>
              <button
                onClick={handleBuyNow}
                disabled={ordering}
                className="flex-1 rounded-xl bg-hub-accentLight py-3.5 text-center text-sm font-medium text-white disabled:opacity-50"
              >
                {ordering ? "Placing..." : "Buy Now"}
              </button>
            </div>
            <button
              onClick={toggleCart}
              disabled={cartBusy}
              className={`mt-2 w-full rounded-xl border py-3 text-center text-sm font-medium disabled:opacity-50 ${
                inCart ? "border-hub-accentLight text-hub-accentLight" : "border-hub-border text-white"
              }`}
            >
              {cartBusy ? "..." : inCart ? "Remove from Cart" : "Add to Cart"}
            </button>
          </>
        )}
        {orderError && <p className="mt-2 text-xs text-red-400">{orderError}</p>}
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
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
function ImagePlaceholderIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21 16l-5-5-4 4-2-2-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
