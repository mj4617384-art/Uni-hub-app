
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/lib/theme/ThemeProvider";

type MenuItem = {
  label: string;
  sub: string;
  href: string;
  icon: JSX.Element;
  comingSoon?: boolean;
};

export default function SidebarMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, department, avatar_url")
        .eq("id", data.user.id)
        .single();
      setFirstName(profile?.first_name ?? null);
      setDepartment(profile?.department ?? null);
      setAvatarUrl(profile?.avatar_url ?? null);
    }
    if (isOpen) load();
  }, [isOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const menuItems: MenuItem[] = [
    { label: "My Profile", sub: "View & edit profile", href: "/profile", icon: <UserIcon /> },
    { label: "My Posts", sub: "Posts, likes & saved", href: "/profile?tab=posts", icon: <PostsIcon />, comingSoon: true },
    { label: "Bookmarks", sub: "Saved items", href: "/profile?tab=saved", icon: <BookmarkIconSb />, comingSoon: true },
    { label: "My Orders", sub: "Marketplace orders", href: "/orders", icon: <OrdersIcon />, comingSoon: true },
    { label: "My Wallet", sub: "Balance & transactions", href: "/wallet", icon: <WalletIconSb /> },
    { label: "Invite Friends", sub: "Earn rewards", href: "/invite", icon: <GiftIcon />, comingSoon: true },
    { label: "Settings", sub: "App preferences", href: "/settings", icon: <SettingsIcon />, comingSoon: true },
    { label: "Help & Support", sub: "Get help", href: "/support", icon: <HelpIcon />, comingSoon: true },
    { label: "Switch Campus", sub: "Change university", href: "/switch-campus", icon: <CampusIcon />, comingSoon: true },
  ];

  function handleItemClick(item: MenuItem) {
    onClose();
    if (item.comingSoon) {
      alert(`${item.label} is coming soon.`);
      return;
    }
    router.push(item.href);
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-[82%] max-w-xs bg-hub-card transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="bg-gradient-to-br from-hub-accent to-hub-accentLight px-5 pb-5 pt-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center text-base font-semibold text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : firstName ? (
                  firstName.charAt(0).toUpperCase()
                ) : (
                  "U"
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-white">{firstName ?? "Student"}</p>
                <p className="text-xs text-white/80">{department ?? ""}</p>
              </div>
            </div>
            <button onClick={toggleTheme} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto px-2 py-2" style={{ maxHeight: "calc(100% - 110px)" }}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleItemClick(item)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-hub-card2"
            >
              <span className="shrink-0 text-hub-accentLight">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-hub-text">{item.label}</span>
                <span className="block text-[11px] text-hub-textDim">{item.sub}</span>
              </span>
              <ChevronIcon />
            </button>
          ))}

          <button
            onClick={handleLogout}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-red-500/50 px-3 py-2.5 text-sm font-medium text-red-400"
          >
            <LogoutIcon />
            Logout
          </button>

          <p className="mt-4 pb-4 text-center text-[10px] text-hub-textDim">Uni.hub v1.0</p>
        </div>
      </div>
    </>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function PostsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function BookmarkIconSb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12v18l-6-4-6 4V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function WalletIconSb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 13h2M3 9h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function GiftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="9" width="16" height="11" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9h16v4H4V9zM12 9v11" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9C10 5 6 6 6 8.5S9 9 12 9zM12 9c2-4 6-3 6-.5S15 9 12 9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.6a7 7 0 00-2-1.2L14 3h-4l-.5 2.2a7 7 0 00-2 1.2l-2.4-.6-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-.6a7 7 0 002 1.2L10 21h4l.5-2.2a7 7 0 002-1.2l2.4.6 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 1.8-2.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}
function CampusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 11v6c0 1 3 3 7 3s7-2 7-3v-6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-hub-textDim">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 00-2 2v12a2 2 0 002 2h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M20 14.5A8.5 8.5 0 1110 3.5a7 7 0 0010 11z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
