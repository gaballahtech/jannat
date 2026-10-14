/* Jannat brand mark — two tiles picked by the owner:
   logo-light.webp (dark letters) shows in light mode,
   logo-dark.webp (white letters) shows in dark mode.
   Follows the OS setting automatically (no toggle) via Tailwind's dark: variant. */
export default function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} role="img" aria-label="Jannat">
      <img
        src="/logo-light.webp"
        alt=""
        decoding="async"
        className="h-full w-full rounded-[24%] object-cover dark:hidden"
      />
      <img
        src="/logo-dark.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        className="hidden h-full w-full rounded-[24%] object-cover dark:block"
      />
    </span>
  );
}
