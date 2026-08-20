"use client";

import { useRouter } from "next/navigation";

export default function UpgradeSuccessPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-hub-bg px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
        <CheckIcon />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-white">Upgrade Successful!</h1>
      <p className="mt-1 text-sm text-hub-textDim">
        You are now a Seller Pro. Enjoy all premium features and take your sales to the next level.
      </p>

      <button
        onClick={() => router.push("/marketplace/dashboard")}
        className="mt-8 w-full max-w-xs rounded-xl bg-hub-accentLight py-3.5 text-sm font-medium text-white"
      >
        Go to Dashboard
      </button>
      <button onClick={() => router.push("/marketplace")} className="mt-3 text-sm text-hub-accentLight">
        View My Shop
      </button>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
