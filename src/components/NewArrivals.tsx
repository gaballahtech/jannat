import { useMemo } from 'react';
import { useCatalog } from '../catalog/CatalogContext';
import { SectionHeader } from './FeaturedProducts';
import ProductCard from './ProductCard';

export default function NewArrivals() {
  const products = useCatalog();
  // New Arrivals = most recently added (by date added, newest first).
  const arrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [products]);
  return (
    <section id="arrivals" className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
      <SectionHeader title="New Arrivals" link="SHOP ALL" href="/shop" />
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5 lg:gap-7">
        {arrivals.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
