"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AddMoneyPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/auth");
      return;
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userData.user.id)
      .single();

    if (!wallet) {
      setError("Wallet not found.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.rpc("add_money", {
      p_wallet_id: wallet.id,
      p_amount: Number(amount),
      p_description: "Manual top-up",
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/wallet");
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pt-5">
      <button onClick={() => router.back()} aria-label="Back" className="mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <h1 className="text-xl font-semibold">Add Money</h1>
      <p className="mt-1 text-sm text-hub-textDim">
        Note: this is a test top-up — no real payment is processed yet.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Amount (₦)</span>
          <input
            required
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
        >
          {loading ? "Adding..." : "Add Money"}
        </button>
      </form>
    </main>
  );
}
