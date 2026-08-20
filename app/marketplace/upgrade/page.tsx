"use client";

import { useRouter } from "next/navigation";

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Create Listings", free: "3 active", pro: "Unlimited" },
  { label: "Boost Listings", free: false, pro: true },
  { label: "Analytics & Insights", free: false, pro: true },
  { label: "Auto Relist", free: false, pro: true },
  { label: "Priority Support", free: false, pro: true },
  { label: "Featured Badge", free: false, pro: true },
];

export default function UpgradePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-hub-bg px-5 pb-16 pt-5">
      <button onClick={() => router.back()} aria-label="Back" className="text-hub-textDim">
        <BackIcon />
      </button>

      <div className="mt-6 flex flex-col items-center text-center">
        <span className="text-5xl">👑</span>
        <h1 className="mt-3 text-xl font-semibold text-white">Upgrade to Seller Pro</h1>
        <p className="mt-1 text-sm text-hub-textDim">
          Unlock all features and grow your business on Uni.hub Marketplace.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-hub-border bg-hub-card">
        <div className="grid grid-cols-3 border-b border-hub-border px-3 py-2 text-xs font-medium text-hub-textDim">
          <span>Features</span>
          <span className="text-center">Free</span>
          <span className="text-center text-hub-accentLight">Pro 👑</span>
        </div>
        {FEATURES.map((f) => (
          <div key={f.label} className="grid grid-cols-3 items-center border-b border-hub-border px-3 py-2.5 text-xs last:border-b-0">
            <span className="text-white/90">{f.label}</span>
            <span className="text-center text-hub-textDim">
              {typeof f.free === "string" ? f.free : f.free ? "✓" : "✕"}
            </span>
            <span className="text-center font-medium text-hub-accentLight">
              {typeof f.pro === "string" ? f.pro : f.pro ? "✓" : "✕"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-2xl font-semibold text-white">
          ₦3,000 <span className="text-sm font-normal text-hub-textDim">/ 30 days</span>
        </p>
        <p className="mt-1 text-xs text-hub-textDim">Cancel anytime</p>
      </div>

      <button
        onClick={() => router.push("/marketplace/upgrade/payment")}
        className="mt-6 w-full rounded-xl bg-hub-accentLight py-3.5 text-sm font-medium text-white"
      >
        Continue to Payment
      </button>
      <p className="mt-3 text-center text-[11px] text-hub-textDim">Secure payment powered by Uni.hub</p>
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
