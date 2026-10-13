export default function NotFound({ title = 'Page not found', hint = 'This link is old, moved, or mistyped.' }: { title?: string; hint?: string }) {
  return (
    <section className="mx-auto flex max-w-[1400px] flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-10">
      <p className="text-[11px] font-normal tracking-[0.3em] text-black/60 dark:text-white/60">404 — PEARLIN</p>
      <h1 className="font-display mt-4 text-5xl font-normal uppercase tracking-tight sm:text-6xl">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-[13px] leading-relaxed tracking-wide text-black/55 dark:text-white/55">{hint}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a
          href="/shop"
          className="rounded-full bg-black px-8 py-3.5 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
        >
          SHOP ALL
        </a>
        <a
          href="/"
          className="rounded-full border border-black/20 dark:border-white/20 px-8 py-3.5 text-[12px] font-normal tracking-[0.2em] transition hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:text-black dark:hover:bg-white dark:hover:text-black"
        >
          HOME
        </a>
      </div>
    </section>
  );
}
