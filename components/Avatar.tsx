type AvatarProps = {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  className?: string;
};

export default function Avatar({ url, name, size = 36, className = "" }: AvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : "U";
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full bg-hub-card2 border border-hub-border flex items-center justify-center text-xs font-medium text-white ${className}`}
      style={{ height: size, width: size }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
