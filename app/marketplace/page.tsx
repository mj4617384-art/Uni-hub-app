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
  created_at: string;
  seller_name?: string;
  seller_avatar?: string | null;
  seller_campus?: string | null;
};

type SortOption = "newest" | "price_asc" | "price_desc";

const categories = ["All", "Electronics", "Books", "Fashion", "Others"];

export default function MarketplacePage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  const [sort, setSort] = useState<SortOption>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      const { data } = await supabase
        .from("marketplace_items")
        .select("id, title, price, category, image_urls, seller_id, created_at, profiles(first_name, avatar_url, campus)")
        .eq("status", "available")
        .order("created_at", { ascending: false });

      const mapped: Item[] = (data ?? []).map((i: any) => ({
        id: i.id,
        title: i.title,
        price: i.price,
        category: i.category,
        image_urls: i.image_urls,
        seller_id: i.seller_id,
        created_at: i.created_at,
        seller_name: i.profiles?.first_name ?? "Student",
        seller_avatar: i.profiles?.avatar_url ?? null,
        seller_campus: i.profiles?.campus ?? null,
      }));
      setItems(mapped);
      setLoading(false);

      if (uid) {
        const { data: savesData } = await supabase
          .from("marketplace_saves")
          .select("item_id")
          .eq("user_id", uid);
        const savedMap: Record<string, boolean> = {};
        (savesData ?? []).forEach((s: any) => { savedMap[s.item_id] = true; });
        setSaved(savedMap);
      }
    }
    load();
  }, []);

  async function toggleSave(itemId: string) {
    if (!userId) return;
    setSavingId(itemId);
    const isSaved = !!saved[itemId];

    if (isSaved) {
      setSaved((prev) => ({ ...prev, [itemId]: false }));
      const { error } = await supabase
        .from("marketplace_saves")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", userId);
      if (error) {
        setSaved((prev) => ({ ...prev, [itemId]: true }));
        alert("Unsave failed: " + error.message);
      }
    } else {
      setSaved((prev) => ({ ...prev, [itemId]: true }));
      const { error } = await supabase
        .from("marketplace_saves")
        .insert({ item_id: itemId, user_id: userId });
      if (error) {
        setSaved((prev) => ({ ...prev, [itemId]: false }));
        alert("Save failed: " + error.message);
      }
    }
    setSavingId(null);
  }

  function messageSeller(sellerId: string) {
    router.push(`/messages?seller=${sellerId}`);
  }

  const filtered = items
    .filter((i) => {
      const matchesSearch =
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        (i.seller_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "All" || i.category === activeCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return Number(a.price) - Number(b.price);
      if (sort === "price_desc") return Number(b.price) - Number(a.price);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const sortLabels: Record<SortOption, string> = {
    newest: "Newest",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
  };

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">
            Uni<span className="text-hub-accentLight">.hub</span> Marketplace
          </h1>
          <p className="text-sm text-hub-textDim">Buy and sell within your campus.</p>
        </div>
      </div>

      <div className="mx-5 mt-4 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items, sellers, or categories..."
          className="flex-1 rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
        />
        <div className="relative shrink-0">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-hub-border bg-hub-card2 text-hub-textDim"
            aria-label="Sort"
          >
            <FilterIcon />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-hub-border bg-hub-card2 py-1 shadow-lg">
              {(Object.keys(sortLabels) as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setSort(opt); setSortOpen(false); }}
                  className={`block w-full px-3 py-2 text-left text-xs ${sort === opt ? "text-hub-accentLight" : "text-white/90"}`}
                >
                  {sortLabels[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-hub-border bg-hub-card2 text-hub-textDim"
          aria-label="Toggle view"
        >
          {viewMode === "grid" ? <ListViewIcon /> : <GridViewIcon />}
        </button>
      </div>

      <div className="mx-5 mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
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

        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`overflow-hidden rounded-xl border border-hub-border bg-hub-card ${viewMode === "list" ? "flex" : ""}`}
            >
              <div className={`relative ${viewMode === "list" ? "h-28 w-28 shrink-0" : ""}`}>
                <span className="absolute left-2 top-2 z-10 rounded-md bg-hub-accentLight px-2 py-0.5 text-[10px] font-medium text-white">
                  For Sale
                </span>
                <button
                  onClick={() => toggleSave(item.id)}
                  disabled={!userId || savingId === item.id}
                  aria-label="Save item"
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-50"
                >
                  <HeartIcon filled={!!saved[item.id]} />
                </button>
                <button
                  onClick={() =>
                    item.image_urls && item.image_urls.length > 0 && setLightboxImages(item.image_urls)
                  }
                  className={`flex w-full items-center justify-center bg-hub-card2 text-hub-textDim ${viewMode === "list" ? "h-28" : "h-32"}`}
                >
                  {item.image_urls && item.image_urls.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_urls[0]} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlaceholderIcon />
                  )}
                </button>
              </div>

              <button onClick={() => router.push(`/marketplace/${item.id}`)} className="flex-1 p-3 text-left">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="mt-0.5 text-sm font-semibold text-hub-accentLight">
                  ₦{Number(item.price).toLocaleString()}
                </p>
                <span className="mt-1 inline-block rounded-md border border-hub-border px-1.5 py-0.5 text-[10px] text-hub-textDim capitalize">
                  {item.category}
                </span>

                <div className="mt-2 flex items-center gap-1.5">
                  <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-[9px] font-medium text-white">
                    {item.seller_avatar ? (
                      <img src={item.seller_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      item.seller_name?.charAt(0).toUpperCase() ?? "U"
                    )}
                  </div>
                  <p className="truncate text-[11px] text-hub-textDim">
                    {item.seller_name}{item.seller_campus ? ` · ${item.seller_campus}` : ""}
                  </p>
                </div>

                {userId === item.seller_id ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/marketplace/${item.id}/edit`);
                    }}
                    className="mt-2 inline-block text-xs text-hub-accentLight underline"
                  >
                    Edit listing
                  </span>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        messageSeller(item.seller_id);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-hub-border px-2 py-1 text-[11px] text-white"
                    >
                      <MessageIcon /> Message
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/marketplace/${item.id}`);
                      }}
                      className="rounded-lg bg-hub-accentLight px-2 py-1 text-[11px] font-medium text-white"
                    >
                      Buy Now
                    </span>
                  </div>
                )}
              </button>
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
function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function GridViewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function ListViewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="10" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="16" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path d="M12 21s-7-4.35-9.5-9C.7 8.1 2.6 4 6.5 4c2 0 3.5 1.2 4.5 2.6C12 5.2 13.5 4 15.5 4 19.4 4 21.3 8.1 19.5 12c-2.5 4.65-9.5 9-9.5 9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function MessageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
