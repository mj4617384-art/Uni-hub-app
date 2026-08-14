"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DISCOVER_TABS } from "@/lib/discover/shared";
import BottomNav from "@/components/BottomNav";

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-hub-bg pb-28">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-semibold text-white">Discover</h1>
        <div className="mt-4 flex gap-5 overflow-x-auto border-b border-hub-border pb-2 scrollbar-hide">
          {DISCOVER_TABS.map((tab) => {
            const active = tab.href === "/discover" ? pathname === "/discover" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 pb-2 text-sm ${
                  active
                    ? "text-hub-accentLight border-b-2 border-hub-accentLight font-medium"
                    : "text-hub-textDim"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}

      <BottomNav />
    </main>
  );
}
