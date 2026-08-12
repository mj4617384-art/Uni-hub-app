"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/auth");
        return;
      }

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", userData.user.id)
        .single();

      if (wallet) {
        setBalance(Number(wallet.balance));

        const { data: txns } = await supabase
          .from("wallet_transactions")
          .select("id, type, amount, description, created_at")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false })
          .limit(10);
        setTransactions(txns ?? []);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => router.back()} aria-label="Back">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Wallet</h1>
          <p className="text-sm text-hub-textDim">Manage your money and transactions.</p>
        </div>
      </div>

      <div className="mx-5 mt-5 rounded-2xl bg-hub-accent p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/80">Uni.hub Balance</p>
          <button onClick={() => setShowBalance((s) => !s)} aria-label="Toggle balance visibility">
            <EyeIcon show={showBalance} />
          </button>
        </div>
        <p className="mt-1 text-3xl font-semibold text-white">
          {showBalance ? `₦${(balance ?? 0).toLocaleString()}` : "₦••••••"}
        </p>
      </div>

      <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
        <ActionButton label="Add Money" icon={<PlusCircleIcon />} onClick={() => router.push("/wallet/add")} />
        <ActionButton label="Send Money" icon={<SendIcon />} onClick={() => router.push("/wallet/send")} />
        <ActionButton label="History" icon={<HistoryIcon />} onClick={() => router.push("/wallet/history")} />
      </div>

      <div className="mx-5 mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-hub-textDim">Recent Transactions</h2>
          <button onClick={() => router.push("/wallet/history")} className="text-xs text-hub-accentLight">
            View all
          </button>
        </div>

        {transactions.length === 0 && (
          <p className="text-sm text-hub-textDim">No transactions yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {transactions.map((t) => {
            const isCredit = t.type === "add_money" || t.type === "receive_money";
            return (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-hub-border bg-hub-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isCredit ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {isCredit ? <ArrowDownIcon /> : <ArrowUpIcon />}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{t.type.replace("_", " ")}</p>
                    {t.description && <p className="text-xs text-hub-textDim">{t.description}</p>}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                  {isCredit ? "+" : "-"}₦{Number(t.amount).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: JSX.Element; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-xl border border-hub-border bg-hub-card p-4">
      <span className="text-hub-accentLight">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function BackIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.6" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4.5 10 8-.31.99-.84 2.02-1.56 3M6.6 6.6C4.3 8.05 2.6 10.2 2 12c1 3.5 5 8 10 8 1.35 0 2.63-.28 3.78-.78" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}
function PlusCircleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function SendIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 3L11 13M21 3l-7 18-4-8-8-4 19-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function HistoryIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 109-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M3 3v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ArrowDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ArrowUpIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
