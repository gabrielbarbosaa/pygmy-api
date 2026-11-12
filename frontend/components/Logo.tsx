export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c6cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#pg)" />
      <circle cx="10" cy="16" r="2.4" fill="#fff" />
      <circle cx="16" cy="16" r="2.4" fill="#fff" fillOpacity=".85" />
      <circle cx="22" cy="16" r="2.4" fill="#fff" fillOpacity=".6" />
    </svg>
  );
}
