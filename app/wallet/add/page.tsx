"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        onClose: () => void;
        callback: (response: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

export default function AddMoneyPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!window.PaystackPop) {
      setError("Payment system is still loading — try again in a moment.");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !userData.user.email) {
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

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
      email: userData.user.email,
      amount: Number(amount) * 100, // Paystack expects kobo
      currency: "NGN",
      ref: `uni-hub-${Date.now()}`,
      onClose: () => {
        setLoading(false);
      },
      callback: (response) => {
        (async () => {
          const res = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, walletId: wallet.id }),
          });
          const result = await res.json();
          setLoading(false);
          if (!res.ok) {
            setError(result.error || "Payment verification failed.");
            return;
          }
          router.push("/wallet");
        })();
      },
    });

    handler.openIframe();
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
        Fund your wallet securely via card, bank transfer, or USSD.
      </p>

      <form onSubmit={handlePay} className="mt-6 flex flex-col gap-4">
        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Amount (₦)</span>
          <input
            required
            type="number"
            min="100"
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
          {loading ? "Processing..." : "Proceed to Pay"}
        </button>
      </form>
    </main>
  );
}
