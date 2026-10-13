import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, lazy, useEffect } from 'react';
import AnnouncementBanner from './components/AnnouncementBanner';
import CartDrawer from './components/CartDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import FeaturedProducts from './components/FeaturedProducts';
import Footer from './components/Footer';
import Header from './components/Header';
import Hero from './components/Hero';
import NewArrivals from './components/NewArrivals';
import NotFound from './components/NotFound';
import ProductPage from './components/ProductPage';
import { TrustStrip } from './components/Reviews';
import SearchPage from './components/SearchPage';
import ShopPage from './components/ShopPage';
import SocialConnect from './components/SocialConnect';
import { CATEGORIES } from './data/store';
import { consumeLegacyHash, consumePendingSection, initLinkInterception, scrollToSection, useRoute } from './router';
import { CatalogProvider, useCatalog, useCategories } from './catalog/CatalogContext';
import { ShopProvider, useShop } from './store/CartContext';

// Owner dashboard loads on demand — shoppers never download it.
const Admin = lazy(() => import('./components/Admin'));

function Toast() {
  const { toast } = useShop();
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-6 left-1/2 z-[60] max-w-[90vw] rounded-full bg-black px-6 py-3 text-center text-[11px] font-normal tracking-[0.2em] text-white shadow-2xl"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HomeView() {
  useEffect(() => {
    const section = consumePendingSection();
    if (section) scrollToSection(section);
  }, []);
  return (
      <main>
        <Hero />
        <TrustStrip />
        <FeaturedProducts />
        <NewArrivals />
        <SocialConnect />
      </main>
  );
}

function titlesFor(
  route: ReturnType<typeof useRoute>,
  productName?: string,
  cats: readonly { readonly id: string; readonly label: string }[] = CATEGORIES,
): string {
  const base = 'pearlin — Hoodies & Essentials | Egypt';
  if (route.view === 'product') {
    return productName ? `${productName} | pearlin Egypt` : base;
  }
  if (route.view === 'shop') {
    if (route.saved) return 'Wishlist | pearlin Egypt';
    const cat = cats.find((c) => c.id === route.category);
    return cat && cat.id !== 'all' ? `${cat.label} | pearlin Egypt` : `Shop All | pearlin Egypt`;
  }
  if (route.view === 'search') {
    return route.q ? `Search: ${route.q} | pearlin Egypt` : 'Search | pearlin Egypt';
  }
  if (route.view === 'admin') {
    const t = route.tab.charAt(0).toUpperCase() + route.tab.slice(1);
    return `Admin — ${t} | pearlin`;
  }
  if (route.view === 'notfound') {
    return 'Page not found | pearlin Egypt';
  }
  return base;
}

function Shell() {
  const route = useRoute();
  const products = useCatalog();
  const cats = useCategories();

  useEffect(() => {
    const name =
      route.view === 'product' ? products.find((p) => p.id === route.id)?.name : undefined;
    document.title = titlesFor(route, name, cats);
    // Never let search engines index the owner-only dashboard.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (route.view === 'admin') {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'robots';
        document.head.appendChild(meta);
      }
      meta.content = 'noindex, nofollow';
    } else if (meta) {
      meta.content = 'all';
    }
  }, [route, products, cats]);

  return (
    <div className="min-h-screen bg-white text-[#111111] dark:bg-[#0b0b0b] dark:text-[#f2f2f2]">
      <AnnouncementBanner />
      <Header />
      {route.view === 'shop' ? (
        <main>
          <ShopPage key={`${route.category}-${route.saved}`} />
        </main>
      ) : route.view === 'product' ? (
        <main>
          <ProductPage key={route.id} productId={route.id} />
        </main>
      ) : route.view === 'search' ? (
        <main>
          <SearchPage />
        </main>
      ) : route.view === 'admin' ? (
        <main>
          <Suspense
            fallback={
      <p className="mx-auto max-w-[1200px] px-4 py-24 text-center text-[12px] tracking-[0.24em] text-black/50 dark:text-white/65">
        LOADING DASHBOARD…
      </p>
            }
          >
            <Admin />
          </Suspense>
        </main>
      ) : route.view === 'notfound' ? (
        <main>
          <NotFound />
        </main>
      ) : (
        <HomeView />
      )}
      <Footer />
      <CartDrawer />
      <Toast />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initLinkInterception();
    consumeLegacyHash();
  }, []);
  return (
    <ErrorBoundary>
      <CatalogProvider>
        <ShopProvider>
          <Shell />
        </ShopProvider>
      </CatalogProvider>
    </ErrorBoundary>
  );
}
