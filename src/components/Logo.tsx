/* Adaptive brand mark: black on light mode, white on dark mode.
   Follows the OS setting automatically (no toggle) via Tailwind's dark: variant. */
export default function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} role="img" aria-label="pearlin">
      <img
        src="/logo-black.png"
        alt=""
        decoding="async"
        className="h-full w-auto dark:hidden"
      />
      <img
        src="/logo-white.png"
        alt=""
        aria-hidden="true"
        decoding="async"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
