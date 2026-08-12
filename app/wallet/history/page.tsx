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

export default function WalletHistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => {
    async function load() {
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

      if (wallet) {
        const { data: txns } = await supabase
          .from("wallet_transactions")
          .select("id, type, amount, description, created_at")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false });
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
          <h1 className="text-xl font-semibold">Transaction History</h1>
          <p className="text-sm text-hub-textDim">All your wallet activity.</p>
        </div>
      </div>

      <div className="mx-5 mt-6">
        {transactions.length === 0 && (
          <p className="text-sm text-hub-textDim">No transactions yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {transactions.map((t) => {
            const isCredit = t.type === "add_money" || t.type === "receive_money";
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="flex items-center justify-between rounded-xl border border-hub-border bg-hub-card p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      isCredit ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {isCredit ? <ArrowDownIcon /> : <ArrowUpIcon />}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{t.type.replace("_", " ")}</p>
                    {t.description && <p className="text-xs text-hub-textDim">{t.description}</p>}
                    <p className="text-xs text-hub-textDim">{formatDate(t.created_at)}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                  {isCredit ? "+" : "-"}₦{Number(t.amount).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <ReceiptSheet transaction={selected} onClose={() => setSelected(null)} />
      )}

      <BottomNav />
    </main>
  );
}

function ReceiptSheet({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const isCredit = transaction.type === "add_money" || transaction.type === "receive_money";
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl border-t border-hub-border bg-hub-bg p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hub-border" />

        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
              isCredit ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {isCredit ? <ArrowDownIcon /> : <ArrowUpIcon />}
          </div>
          <p className={`text-2xl font-semibold ${isCredit ? "text-green-400" : "text-red-400"}`}>
            {isCredit ? "+" : "-"}₦{Number(transaction.amount).toLocaleString()}
          </p>
          <p className="mt-1 text-sm capitalize text-hub-textDim">
            {transaction.type.replace("_", " ")}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-hub-border bg-hub-card p-4">
          <Row label="Status" value="Completed" />
          <Row label="Description" value={transaction.description ?? "—"} />
          <Row label="Date" value={formatDate(transaction.created_at)} />
          <Row label="Reference" value={transaction.id} />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-hub-accent py-3 text-sm font-medium text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-hub-textDim">{label}</span>
      <span className="max-w-[65%] truncate text-right text-xs">{value}</span>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
