export default function CampusSkyline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 160"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skylineFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12203f" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0a0f1e" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="60" width="30" height="100" fill="url(#skylineFade)" />
      <rect x="35" y="40" width="22" height="120" fill="url(#skylineFade)" />
      <polygon points="150,0 175,40 125,40" fill="url(#skylineFade)" />
      <rect x="135" y="40" width="80" height="120" fill="url(#skylineFade)" />
      <rect x="160" y="10" width="10" height="30" fill="url(#skylineFade)" />
      <rect x="230" y="55" width="26" height="105" fill="url(#skylineFade)" />
      <rect x="265" y="30" width="18" height="130" fill="url(#skylineFade)" />
      <rect x="300" y="65" width="34" height="95" fill="url(#skylineFade)" />
      <rect x="345" y="45" width="24" height="115" fill="url(#skylineFade)" />
      <rect x="375" y="70" width="25" height="90" fill="url(#skylineFade)" />
    </svg>
  );
}
