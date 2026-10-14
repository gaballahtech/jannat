/* Jannat brand mark — single beige tile used in both modes. */
export default function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="/jannat.webp"
      alt="Jannat"
      decoding="async"
      className={`shrink-0 rounded-[24%] object-cover ${className}`}
    />
  );
}
