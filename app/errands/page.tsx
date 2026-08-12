"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Errand = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
};

export default function ErrandsPage() {
  const router = useRouter();
  const [errands, setErrands] = useState<Errand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("errands")
        .select("id, title, description, price, status")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      setErrands(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = errands.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Errands</h1>
          <p className="text-sm text-hub-textDim">Get things done around campus.</p>
        </div>
      </div>

      <div className="mx-5 mt-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search errands..."
          className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
        />
      </div>

      <div className="mx-5 mt-6">
        <h2 className="mb-3 text-sm font-medium text-hub-textDim">
          {search ? "Results" : "Popular Errands"}
        </h2>

        {loading && <p className="text-sm text-hub-textDim">Loading...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-hub-textDim">No errands yet — be the first to post one.</p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-hub-border bg-hub-card p-4"
            >
              <div>
                <p className="text-sm font-medium">{e.title}</p>
                {e.description && (
                  <p className="mt-0.5 text-xs text-hub-textDim">{e.description}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-hub-accentLight">
                ₦{Number(e.price).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => router.push("/errands/new")}
        className="fixed bottom-24 left-1/2 flex w-[calc(100%-2.5rem)] max-w-[calc(28rem-2.5rem)] -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-hub-accent py-3.5 font-medium text-white"
      >
        <PlusIcon /> Create a New Errand
      </button>

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
