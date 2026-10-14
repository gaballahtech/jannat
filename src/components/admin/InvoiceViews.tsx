import { useEffect, useRef, useState } from 'react';
import { getContact, getSettings, type Invoice } from '../../admin/adminData';
import { useCatalog as useCatalogList } from '../../catalog/CatalogContext';
import { formatEGP } from '../../data/store';

/* Fixed 640px invoice document — the PNG export target.
   Keep in sync with src/admin/invoiceCanvas.ts (canvas renderer). */
export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const products = useCatalogList();
  const biz = getSettings();
  const contact = getContact();
  const discount = invoice.discount ?? 0;
  const d = new Date(invoice.createdAt);
  const dateStr = Number.isNaN(d.getTime())
    ? invoice.createdAt
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const loc = [invoice.buyerCity, invoice.buyerAddress].filter(Boolean).join(' · ');
  const thumb = (productId: string, variant: string): string | undefined => {
    const p = products.find((x) => x.id === productId);
    return (
      p?.variants.find((v) => v.name === variant)?.image ?? p?.variants[0]?.image ?? undefined
    );
  };
  const SERIF = "Didot, 'Playfair Display', Georgia, 'Times New Roman', serif";
  const SANS = "Arial, Helvetica, sans-serif";
  return (
    <div
      style={{ fontFamily: SANS, width: 640, minWidth: 640, background: '#fff', color: '#111' }}
    >
      {/* Brand band */}
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/jannat.webp" alt="jannat" style={{ height: 40 }} />
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, letterSpacing: 3 }}>
              Invoice
            </p>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, marginTop: 2 }}>
              {invoice.number}
            </p>
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              Issued {dateStr}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 40px 32px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1.2, background: '#f4f4f4', borderRadius: 14, padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: '#777' }}>
              BILL TO
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {invoice.buyerName || '—'}
            </p>
            <p style={{ fontSize: 13, color: '#333', marginTop: 2 }}>{invoice.buyerPhone || ''}</p>
            {loc && <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{loc}</p>}
            {invoice.notes && (
              <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{invoice.notes}</p>
            )}
          </div>
          <div style={{ flex: 1, background: '#f4f4f4', borderRadius: 14, padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: '#777' }}>
              SELLER
            </p>
            <p style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>jannat</p>
            <p style={{ fontSize: 11.5, marginTop: 3, color: '#444' }}>{biz.address}</p>
            <p style={{ fontSize: 11.5, marginTop: 3, color: '#444' }}>
              WhatsApp {contact.whatsappDisplay}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1, background: '#f4f4f4', borderRadius: 14, padding: '12px 20px', fontSize: 12, color: '#333' }}>
            <span style={{ fontWeight: 800 }}>Payment:</span> {invoice.paymentMethod || biz.paymentDefault}
          </div>
          <div style={{ flex: 1, background: '#f4f4f4', borderRadius: 14, padding: '12px 20px', fontSize: 12, color: '#333' }}>
            <span style={{ fontWeight: 800 }}>Delivery:</span> within a week · {formatEGP(invoice.shipping)} flat
          </div>
        </div>

        <table style={{ width: '100%', marginTop: 26, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '0 4px 10px', fontSize: 10, letterSpacing: 2, color: '#888' }}>#</th>
              <th style={{ padding: '0 4px 10px', fontSize: 10, letterSpacing: 2, color: '#888' }}>ITEM</th>
              <th style={{ padding: '0 4px 10px', fontSize: 10, letterSpacing: 2, color: '#888', textAlign: 'center' }}>QTY</th>
              <th style={{ padding: '0 4px 10px', fontSize: 10, letterSpacing: 2, color: '#888', textAlign: 'right' }}>PRICE</th>
              <th style={{ padding: '0 4px 10px', fontSize: 10, letterSpacing: 2, color: '#888', textAlign: 'right' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((l, i) => {
              const img = thumb(l.productId, l.variant);
              return (
                <tr key={i} style={{ borderTop: '1px solid #ececec' }}>
                  <td style={{ padding: '12px 4px', color: '#999', verticalAlign: 'middle' }}>{i + 1}</td>
                  <td style={{ padding: '12px 4px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {img && (
                        <img
                          src={img}
                          alt=""
                          style={{ width: 46, height: 56, objectFit: 'cover', borderRadius: 10, background: '#f0f0f0' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5 }}>{l.name}</div>
                        <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                          {l.variant} · Size {l.size}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 4px', textAlign: 'center', verticalAlign: 'middle' }}>{l.qty}</td>
                  <td style={{ padding: '12px 4px', textAlign: 'right', verticalAlign: 'middle', color: '#444' }}>
                    {formatEGP(l.price)}
                  </td>
                  <td style={{ padding: '12px 4px', textAlign: 'right', verticalAlign: 'middle', fontWeight: 800 }}>
                    {formatEGP(l.price * l.qty)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 22, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '7px 4px' }}>
            <span>Subtotal</span>
            <span>{formatEGP(invoice.subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '7px 4px', borderTop: '1px solid #f0f0f0' }}>
              <span>Discount</span>
              <span>−{formatEGP(discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '7px 4px', borderTop: '1px solid #f0f0f0' }}>
            <span>Shipping</span>
            <span>{formatEGP(invoice.shipping)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              background: '#0a0a0a',
              color: '#fff',
              borderRadius: 12,
              padding: '15px 20px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5 }}>TOTAL DUE</span>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 21 }}>
              {formatEGP(invoice.total)}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #ececec', marginTop: 28, paddingTop: 16, textAlign: 'center' }}>
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, color: '#111' }}>
            Thank you for shopping with jannat.
          </p>
          <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            Questions? WhatsApp {contact.whatsappDisplay} · TikTok {contact.tiktokHandle}
          </p>
          <p style={{ fontSize: 10.5, color: '#999', marginTop: 4 }}>{biz.terms}</p>
        </div>
      </div>
      <div
        style={{
          background: '#0a0a0a',
          color: '#fff',
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          padding: '17px 0',
        }}
      >
        JANNAT · CAIRO, EGYPT
      </div>
    </div>
  );
}

/* Fit-to-screen preview: the invoice is a fixed 640px document, but the
   preview scales it (via zoom, which affects layout) to always show it
   COMPLETELY — no sideways scrolling, no cut-off parts. The downloaded PNG
   is always rendered full-size from canvas. */
export function FitInvoice({ invoice }: { invoice: Invoice }) {
  const outer = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  useEffect(() => {
    const update = () => {
      const w = outer.current?.clientWidth ?? 640;
      setS(Math.min(1, w / 640));
    };
    update();
    window.addEventListener('resize', update);
    const t = window.setTimeout(update, 400);
    return () => {
      window.removeEventListener('resize', update);
      window.clearTimeout(t);
    };
  }, [invoice]);
  return (
    <div
      ref={outer}
      className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] py-6"
    >
      <div style={{ width: 640, margin: '0 auto', zoom: s }}>
        <InvoiceCard invoice={invoice} />
      </div>
    </div>
  );
}
