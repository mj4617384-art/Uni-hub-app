"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import ImageLightbox from "@/components/ImageLightbox";

type Item = {
  id: string;
  title: string;
  price: number;
  category: string;
  image_urls: string[] | null;
  seller_id: string;
};

const categories = ["All", "Electronics", "Books", "Fashion", "Others"];

export default function MarketplacePage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);

      const { data } = await supabase
        .from("marketplace_items")
        .select("id, title, price, category, image_urls, seller_id")
        .eq("status", "available")
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter((i) => {
    const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || i.category === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Marketplace</h1>
          <p className="text-sm text-hub-textDim">Buy and sell within your campus.</p>
        </div>
      </div>

      <div className="mx-5 mt-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
        />
      </div>

      <div className="mx-5 mt-4 flex gap-2 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${
              activeCategory === c
                ? "bg-hub-accent text-white"
                : "border border-hub-border text-hub-textDim"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mx-5 mt-5">
        {loading && <p className="text-sm text-hub-textDim">Loading...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-hub-textDim">No items yet — be the first to list one.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border border-hub-border bg-hub-card overflow-hidden">
              <button
                onClick={() =>
                  item.image_urls &&
                  item.image_urls.length > 0 &&
                  setLightboxImages(item.image_urls)
                }
                className="flex h-28 w-full items-center justify-center bg-hub-card2 text-hub-textDim"
              >
                {item.image_urls && item.image_urls.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_urls[0]} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <ImagePlaceholderIcon />
                )}
              </button>
              <div className="p-3">
                <p className="text-sm font-medium">{item.title}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm font-semibold text-hub-accentLight">
                    ₦{Number(item.price).toLocaleString()}
                  </p>
                  {userId === item.seller_id && (
                    <button
                      onClick={() => router.push(`/marketplace/${item.id}/edit`)}
                      className="text-xs text-hub-accentLight underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => router.push("/marketplace/new")}
        className="fixed bottom-24 left-1/2 flex w-[calc(100%-2.5rem)] max-w-[calc(28rem-2.5rem)] -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-hub-accent py-3.5 font-medium text-white"
      >
        <PlusIcon /> Sell an Item
      </button>

      {lightboxImages && (
        <ImageLightbox
          images={lightboxImages}
          startIndex={0}
          onClose={() => setLightboxImages(null)}
        />
      )}

      <BottomNav />
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
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function ImagePlaceholderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21 16l-5-5-4 4-2-2-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
