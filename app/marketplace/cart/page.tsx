"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CartItem = {
  cartId: string;
  itemId: string;
  title: string;
  price: number;
  image_url: string | null;
  seller_id: string;
};

export default function CartPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/auth");
        return;
      }
      setUserId(userData.user.id);

      const { data, error: fetchErr } = await supabase
        .from("marketplace_cart_items")
        .select("id, item_id, marketplace_items(id, title, price, image_urls, seller_id)")
        .eq("user_id", userData.user.id)
        .order("added_at", { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      const mapped: CartItem[] = (data ?? [])
        .filter((c: any) => c.marketplace_items)
        .map((c: any) => ({
          cartId: c.id,
          itemId: c.marketplace_items.id,
          title: c.marketplace_items.title,
          price: c.marketplace_items.price,
          image_url: c.marketplace_items.image_urls?.[0] ?? null,
          seller_id: c.marketplace_items.seller_id,
        }));
      setItems(mapped);
      setLoading(false);
    }
    load();
  }, [router]);

  async function removeItem(cartId: string) {
    setRemovingId(cartId);
    const { error: delErr } = await supabase.from("marketplace_cart_items").delete().eq("id", cartId);
    setRemovingId(null);
    if (delErr) {
      alert("Remove failed: " + delErr.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  async function checkout() {
    if (!userId || items.length === 0) return;
    setCheckingOut(true);
    setError(null);

    const orders = items.map((i) => ({
      item_id: i.itemId,
      buyer_id: userId,
      seller_id: i.seller_id,
      amount: i.price,
      status: "pending",
    }));

    const { error: orderErr } = await supabase.from("marketplace_orders").insert(orders);
    if (orderErr) {
      setError("Checkout failed: " + orderErr.message);
      setCheckingOut(false);
      return;
    }

    await supabase.from("marketplace_cart_items").delete().eq("user_id", userId);
    setCheckingOut(false);
    setDone(true);
  }

  const total = items.reduce((sum, i) => sum + Number(i.price), 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-hub-bg px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
          <CheckIcon />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">Order requests sent!</h1>
        <p className="mt-1 text-sm text-hub-textDim">Sellers will reach out to arrange payment and pickup.</p>
        <button
          onClick={() => router.push("/marketplace")}
          className="mt-8 w-full max-w-xs rounded-xl bg-hub-accentLight py-3.5 text-sm font-medium text-white"
        >
          Back to Marketplace
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pb-16 pt-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back" className="text-white">
          <BackIcon />
        </button>
        <h1 className="text-lg font-semibold text-white">Your Cart</h1>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 text-center text-sm text-hub-textDim">
          Your cart is empty.
          <div>
            <button onClick={() => router.push("/marketplace")} className="mt-3 text-hub-accentLight">
              Browse Marketplace
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.cartId} className="flex items-center gap-3 rounded-xl border border-hub-border bg-hub-card p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-hub-card2">
                  {item.image_url && <img src={item.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-hub-accentLight">₦{Number(item.price).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => removeItem(item.cartId)}
                  disabled={removingId === item.cartId}
                  className="shrink-0 text-xs text-red-400 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-xl border border-hub-border bg-hub-card p-3">
            <span className="text-sm text-hub-textDim">Total</span>
            <span className="text-lg font-semibold text-white">₦{total.toLocaleString()}</span>
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <button
            onClick={checkout}
            disabled={checkingOut}
            className="mt-5 w-full rounded-xl bg-hub-accentLight py-3.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {checkingOut ? "Placing orders..." : "Request Orders"}
          </button>
          <p className="mt-2 text-center text-[11px] text-hub-textDim">
            This sends order requests to sellers — payment is arranged with each seller directly.
          </p>
        </>
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
function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
