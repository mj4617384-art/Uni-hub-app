"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PRICE_NAIRA = 3000;
const PLAN_DAYS = 30;
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
const IS_TEST_MODE = PAYSTACK_PUBLIC_KEY.startsWith("pk_test_");

type Method = "card" | "bank" | "ussd" | "wallet";

export default function UpgradePaymentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [method, setMethod] = useState<Method>("card");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", data.user.id)
        .single();
      setWalletBalance(Number(wallet?.balance ?? 0));
    }
    init();

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [router]);

  async function activateSubscription(paymentMethod: Method, reference: string | null, amountPaid: number) {
    if (!userId) return;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PLAN_DAYS);

    const { error: subErr } = await supabase.from("seller_subscriptions").insert({
      user_id: userId,
      plan: "seller_pro",
      status: "active",
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      payment_reference: reference,
      expires_at: expiresAt.toISOString(),
    });

    if (subErr) {
      setError("Payment succeeded but activation failed: " + subErr.message);
      setPaying(false);
      return;
    }

    router.push("/marketplace/upgrade/success");
  }

  async function payWithWallet() {
    if (!userId) return;
    if (walletBalance < PRICE_NAIRA) {
      setError("Insufficient wallet balance. Top up your wallet or choose another method.");
      return;
    }
    setPaying(true);
    setError(null);

    const { error: walletErr } = await supabase
      .from("wallets")
      .update({ balance: walletBalance - PRICE_NAIRA })
      .eq("user_id", userId);

    if (walletErr) {
      setError("Wallet payment failed: " + walletErr.message);
      setPaying(false);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      amount: PRICE_NAIRA,
      type: "debit",
      description: "Seller Pro subscription",
    });

    await activateSubscription("wallet", null, PRICE_NAIRA);
  }

  function payWithPaystack(channels: string[], methodLabel: Method) {
    if (!scriptLoaded || !email) {
      setError("Payment is still loading — try again in a second.");
      return;
    }
    if (!PAYSTACK_PUBLIC_KEY) {
      setError("Paystack isn't configured yet — missing NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    setPaying(true);
    setError(null);

    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: PRICE_NAIRA * 100,
      currency: "NGN",
      channels,
      ref: `sellerpro_${Date.now()}`,
      callback: (response: any) => {
        activateSubscription(methodLabel, response.reference, PRICE_NAIRA);
      },
      onClose: () => {
        setPaying(false);
      },
    });
    handler.openIframe();
  }

  function handlePay() {
    if (method === "card") payWithPaystack(["card"], "card");
    else if (method === "bank") payWithPaystack(["bank_transfer"], "bank");
    else if (method === "ussd") payWithPaystack(["ussd"], "ussd");
    else payWithWallet();
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pb-16 pt-5">
      <button onClick={() => router.back()} aria-label="Back" className="text-hub-textDim">
        <BackIcon />
      </button>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Choose Payment Method</h1>
        {IS_TEST_MODE && (
          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
            Test Mode
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-hub-textDim">Complete your payment to upgrade to Seller Pro.</p>

      <div className="mt-5 flex flex-col gap-2">
        <MethodRow
          label="Card"
          sub="Debit/Credit cards"
          selected={method === "card"}
          onSelect={() => setMethod("card")}
        />
        <MethodRow
          label="Bank Transfer"
          sub="Pay using bank transfer"
          selected={method === "bank"}
          onSelect={() => setMethod("bank")}
        />
        <MethodRow
          label="USSD"
          sub="Pay with your bank's USSD code"
          selected={method === "ussd"}
          onSelect={() => setMethod("ussd")}
        />
        <MethodRow
          label="Wallet"
          sub={`Pay with Uni.hub wallet · Balance: ₦${walletBalance.toLocaleString()}`}
          selected={method === "wallet"}
          onSelect={() => setMethod("wallet")}
        />
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-hub-border bg-hub-card p-3">
        <span className="text-sm text-hub-textDim">Total Amount</span>
        <span className="text-lg font-semibold text-white">₦{PRICE_NAIRA.toLocaleString()}</span>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <button
        onClick={handlePay}
        disabled={paying}
        className="mt-6 w-full rounded-xl bg-hub-accentLight py-3.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {paying ? "Processing..." : `Pay ₦${PRICE_NAIRA.toLocaleString()}`}
      </button>
      <p className="mt-3 text-center text-[11px] text-hub-textDim">
        🔒 Secure payment. By proceeding, you agree to our Terms of Service.
      </p>
    </main>
  );
}

function MethodRow({ label, sub, selected, onSelect }: { label: string; sub: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center justify-between rounded-xl border border-hub-border bg-hub-card p-3 text-left"
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-hub-textDim">{sub}</p>
      </div>
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-hub-accentLight" : "border-hub-border"}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-hub-accentLight" />}
      </span>
    </button>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
