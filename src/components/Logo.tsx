/* Jannat brand mark — circular artwork (beige/gold), cropped round so it sits
   cleanly on light and dark backgrounds. File: public/jannat.webp */
export default function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="/jannat.webp"
      alt="Jannat"
      decoding="async"
      className={`shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/25 ${className}`}
    />
  );
}
