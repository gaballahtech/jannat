import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useCatalog } from '../catalog/CatalogContext';
import ProductCard from './ProductCard';

export function SectionHeader({
  title,
  link,
  href,
}: {
  title: string;
  link: string;
  href: string;
}) {
  return (
    <div className="mb-10 flex items-end justify-between">
      <h2 className="font-display text-3xl font-normal uppercase tracking-tight sm:text-4xl">
        {title}
      </h2>
      <a
        href={href}
        className="group flex items-center gap-2.5 text-[12px] font-normal tracking-[0.22em]"
      >
        {link}
        <span className="grid h-9 w-9 place-items-center rounded-full border border-black/15 transition group-hover:border-black group-hover:bg-black group-hover:text-white">
          <ArrowRight className="h-4 w-4" />
        </span>
      </a>
    </div>
  );
}

export default function FeaturedProducts() {
  const products = useCatalog();
  // Bestsellers = most units sold, computed live (one word "Bestsellers" is the
  // standard ecommerce spelling).
  const best = useMemo(
    () => [...products].sort((a, b) => b.sold - a.sold).slice(0, 4),
    [products],
  );
  return (
    <section id="featured" className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
      <SectionHeader title="Bestsellers" link="SHOP ALL" href="/shop" />
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7">
        {best.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
