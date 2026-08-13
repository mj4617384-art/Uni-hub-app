"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SendMethod = "email" | "matric";

export default function SendMoneyPage() {
  const router = useRouter();
  const [method, setMethod] = useState<SendMethod>("email");
  const [email, setEmail] = useState("");
  const [matric, setMatric] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
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

    const { error } =
      method === "email"
        ? await supabase.rpc("send_money", {
            p_sender_wallet_id: wallet.id,
            p_recipient_email: email,
            p_amount: Number(amount),
            p_description: note || null,
          })
        : await supabase.rpc("send_money_by_matric_number", {
            p_sender_wallet_id: wallet.id,
            p_recipient_matric: matric,
            p_amount: Number(amount),
            p_description: note || null,
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

      <h1 className="text-xl font-semibold">Send Money</h1>
      <p className="mt-1 text-sm text-hub-textDim">Send to another Uni.hub user by email or matric number.</p>

      <div className="mt-5 flex rounded-xl border border-hub-border bg-hub-card2 p-1">
        <button
          type="button"
          onClick={() => setMethod("email")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            method === "email" ? "bg-hub-accent text-white" : "text-hub-textDim"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("matric")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            method === "matric" ? "bg-hub-accent text-white" : "text-hub-textDim"
          }`}
        >
          Matric Number
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {method === "email" ? (
          <label className="text-sm">
            <span className="mb-1.5 block text-hub-textDim">Recipient's University Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@university.edu"
              className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
            />
          </label>
        ) : (
          <label className="text-sm">
            <span className="mb-1.5 block text-hub-textDim">Recipient's Matric Number</span>
            <input
              required
              type="text"
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              placeholder="e.g. 20/1234"
              className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
            />
          </label>
        )}

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Amount (₦)</span>
          <input
            required
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's this for?"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Money"}
        </button>
      </form>
    </main>
  );
}
