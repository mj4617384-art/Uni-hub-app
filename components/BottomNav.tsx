"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: DiscoverIcon },
  { href: "/messages", label: "Messages", icon: MessagesIcon },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-hub-border bg-hub-card px-4 pb-safe">
      <div className="flex items-center justify-between py-2">
        {items.slice(0, 2).map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} />
        ))}

        <button
          onClick={() => router.push("/create")}
          aria-label="Create"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-hub-accent text-white shadow-lg shadow-hub-accent/30"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {items.slice(2).map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} />
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (props: { active: boolean }) => JSX.Element;
  active: boolean;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 px-2 py-1">
      <Icon active={active} />
      <span className={`text-[11px] ${active ? "text-hub-accentLight" : "text-hub-textDim"}`}>
        {label}
      </span>
    </Link>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "#4C8CFF" : "#8A96AD";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5L12 4l8 7.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  const c = active ? "#4C8CFF" : "#8A96AD";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MessagesIcon({ active }: { active: boolean }) {
  const c = active ? "#4C8CFF" : "#8A96AD";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H9l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z"
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? "#4C8CFF" : "#8A96AD";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.8" />
      <path d="M4.5 20c1.5-4 5-5.5 7.5-5.5s6 1.5 7.5 5.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
