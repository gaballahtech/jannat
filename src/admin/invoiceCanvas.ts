import { formatEGP } from '../data/store';
import { getContact, getSettings } from './adminData';
import type { Invoice } from './adminData';

/* Deterministic invoice renderer: draws the PNG pixel-by-pixel on canvas.
   Unlike DOM-cloning libraries, this cannot produce half-blank or "weird"
   output — no stylesheets, no webfonts, no CORS surprises.
   Invoice is a fixed 640pt document, exported at 2x for crispness.
   Layout follows professional standards: seller + buyer blocks, issue & due
   dates, itemized lines, subtotal / discount / shipping, grand total,
   payment method and terms. */

const W = 640;
const SCALE = 2;
const PAD = 40;
const SERIF = `Georgia, 'Times New Roman', serif`;
const SANS = `Arial, Helvetica, sans-serif`;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImg(src: string | undefined, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = window.setTimeout(() => res(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(t);
      res(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      res(null);
    };
    img.src = src;
  });
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  radius: number,
) {
  ctx.save();
  rr(ctx, dx, dy, dw, dh, radius);
  ctx.clip();
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = dw / dh;
  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  if (ir > dr) {
    sh = img.naturalHeight;
    sw = sh * dr;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / dr;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

function dateStr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ls(ctx: CanvasRenderingContext2D, px: string) {
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = px;
  } catch {
    /* older browsers ignore it */
  }
}

export async function renderInvoicePng(
  inv: Invoice,
  thumbs: Map<string, string | undefined>,
  logoSrc = '/jannat.webp',
): Promise<Blob> {
  const biz = getSettings();
  const contact = getContact();
  const discount = inv.discount ?? 0;

  const photoSrcs = inv.items.map((l) => thumbs.get(`${l.productId}|${l.variant}`));
  const [logo, ...photos] = await Promise.all([loadImg(logoSrc), ...photoSrcs.map((s) => loadImg(s))]);

  const ROW_H = 86;
  const rowsH = inv.items.length * ROW_H;
  const bandH = 150;
  const cardsY = bandH + 26;
  const cardsH = 162;
  const headY = cardsY + cardsH + 38;
  const rowsY = headY + 14;
  // totals rows: subtotal [+ discount] + shipping (full-width rows)
  const totalLines = 2 + (discount > 0 ? 1 : 0);
  const totalsY = rowsY + rowsH + 26;
  const totalsH = 18 + totalLines * 26 + 14 + 62 + 10;
  const footY = totalsY + totalsH + 28;
  const stripH = 54;
  const H = footY + 108 + stripH;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = Math.ceil(H * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  /* ---- brand band ---- */
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, bandH);
  if (logo) {
    const lh = 46;
    const lw = (lh * logo.naturalWidth) / logo.naturalHeight;
    ctx.drawImage(logo, PAD, (bandH - lh) / 2, lw, lh);
  } else {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = `700 30px ${SERIF}`;
    ctx.fillText('jannat', PAD, bandH / 2 + 10);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${SERIF}`;
  ls(ctx, '3px');
  ctx.fillText('Invoice', W - PAD, 66);
  ls(ctx, '0px');
  ctx.font = `800 13px ${SANS}`;
  ctx.fillText(inv.number, W - PAD, 92);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `12px ${SANS}`;
  ctx.fillText(`Issued ${dateStr(inv.createdAt)}`, W - PAD, 112);

  /* ---- seller + buyer cards ---- */
  const gap = 12;
  const leftW = 350;
  const rightW = W - PAD * 2 - gap - leftW;
  ctx.fillStyle = '#f4f4f4';
  rr(ctx, PAD, cardsY, leftW, cardsH, 14);
  ctx.fill();
  rr(ctx, PAD + leftW + gap, cardsY, rightW, cardsH, 14);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#777777';
  ctx.font = `800 10px ${SANS}`;
  ls(ctx, '2.5px');
  ctx.fillText('BILL TO', PAD + 20, cardsY + 28);
  ctx.fillText('SELLER', PAD + leftW + gap + 20, cardsY + 28);
  ls(ctx, '0px');

  ctx.fillStyle = '#111111';
  ctx.font = `700 20px ${SERIF}`;
  ctx.fillText(ellipsis(ctx, inv.buyerName || '—', leftW - 40), PAD + 20, cardsY + 56);
  ctx.fillStyle = '#333333';
  ctx.font = `13px ${SANS}`;
  ctx.fillText(ellipsis(ctx, inv.buyerPhone || '', leftW - 40), PAD + 20, cardsY + 78);
  const loc = [inv.buyerCity, inv.buyerAddress].filter(Boolean).join(' · ');
  if (loc) {
    ctx.fillStyle = '#555555';
    ctx.font = `12px ${SANS}`;
    ctx.fillText(ellipsis(ctx, loc, leftW - 40), PAD + 20, cardsY + 99);
  }
  if (inv.notes) {
    ctx.fillStyle = '#666666';
    ctx.font = `11.5px ${SANS}`;
    ctx.fillText(ellipsis(ctx, inv.notes, leftW - 40), PAD + 20, cardsY + 120);
  }

  const dx = PAD + leftW + gap + 20;
  const dw = rightW - 40;
  ctx.fillStyle = '#111111';
  ctx.font = `800 14px ${SANS}`;
  ctx.fillText(ellipsis(ctx, 'jannat', dw), dx, cardsY + 54);
  ctx.fillStyle = '#444444';
  ctx.font = `11.5px ${SANS}`;
  ctx.fillText(ellipsis(ctx, biz.address, dw), dx, cardsY + 74);
  ctx.fillText(ellipsis(ctx, `WhatsApp ${contact.whatsappDisplay}`, dw), dx, cardsY + 94);

  /* ---- table ---- */
  const numX = PAD;
  const thumbX = PAD + 28;
  const nameX = thumbX + 46 + 12;
  const nameMaxW = 236;
  const qtyCX = 452;
  const priceRX = 528;
  const totalRX = W - PAD;

  ctx.fillStyle = '#888888';
  ctx.font = `800 10px ${SANS}`;
  ls(ctx, '2px');
  ctx.textAlign = 'left';
  ctx.fillText('#', numX, headY);
  ctx.fillText('ITEM', nameX, headY);
  ctx.textAlign = 'center';
  ctx.fillText('QTY', qtyCX, headY);
  ctx.textAlign = 'right';
  ctx.fillText('PRICE', priceRX, headY);
  ctx.fillText('TOTAL', totalRX, headY);
  ls(ctx, '0px');

  inv.items.forEach((l, i) => {
    const ry = rowsY + i * ROW_H;
    ctx.strokeStyle = '#ececec';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, ry);
    ctx.lineTo(W - PAD, ry);
    ctx.stroke();

    ctx.fillStyle = '#999999';
    ctx.font = `12px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), numX, ry + 48);

    const photo = photos[i];
    if (photo) drawCover(ctx, photo, thumbX, ry + 14, 46, 58, 10);
    else {
      ctx.fillStyle = '#f0f0f0';
      rr(ctx, thumbX, ry + 14, 46, 58, 10);
      ctx.fill();
    }

    ctx.fillStyle = '#111111';
    ctx.font = `800 13.5px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(ellipsis(ctx, l.name, nameMaxW), nameX, ry + 40);
    ctx.fillStyle = '#777777';
    ctx.font = `11px ${SANS}`;
    ctx.fillText(ellipsis(ctx, `${l.variant} · Size ${l.size}`, nameMaxW), nameX, ry + 58);

    ctx.fillStyle = '#111111';
    ctx.font = `13px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(l.qty), qtyCX, ry + 48);
    ctx.fillStyle = '#444444';
    ctx.textAlign = 'right';
    ctx.fillText(formatEGP(l.price), priceRX, ry + 48);
    ctx.fillStyle = '#111111';
    ctx.font = `800 13px ${SANS}`;
    ctx.fillText(formatEGP(l.price * l.qty), totalRX, ry + 48);
  });

  /* ---- totals: full invoice width — label far left, amount far right ---- */
  const rowX = PAD;
  let ty = totalsY + 18;
  ctx.font = `13.5px ${SANS}`;
  const moneyRow = (label: string, value: string) => {
    ctx.fillStyle = '#555555';
    ctx.textAlign = 'left';
    ctx.fillText(label, rowX, ty);
    ctx.textAlign = 'right';
    ctx.fillText(value, totalRX, ty);
    ty += 26;
  };
  moneyRow('Subtotal', formatEGP(inv.subtotal));
  if (discount > 0) {
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, ty - 13);
    ctx.lineTo(W - PAD, ty - 13);
    ctx.stroke();
    moneyRow('Discount', `−${formatEGP(discount)}`);
  }
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, ty - 13);
  ctx.lineTo(W - PAD, ty - 13);
  ctx.stroke();
  moneyRow('Shipping', formatEGP(inv.shipping));

  ctx.fillStyle = '#0a0a0a';
  rr(ctx, PAD, ty + 14, W - PAD * 2, 62, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 12px ${SANS}`;
  ls(ctx, '2.5px');
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL DUE', PAD + 20, ty + 52);
  ls(ctx, '0px');
  ctx.font = `700 21px ${SERIF}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatEGP(inv.total), totalRX - 20, ty + 53);

  /* ---- footer ---- */
  const fy = totalsY + totalsH;
  ctx.strokeStyle = '#ececec';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, fy);
  ctx.lineTo(W - PAD, fy);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111111';
  ctx.font = `italic 700 15px ${SERIF}`;
  ctx.fillText('Thank you for shopping with jannat.', W / 2, fy + 30);
  ctx.fillStyle = '#888888';
  ctx.font = `11px ${SANS}`;
  ctx.fillText(
    ellipsis(
      ctx,
      `Pay: ${inv.paymentMethod || biz.paymentDefault} · WhatsApp ${contact.whatsappDisplay} · TikTok ${contact.tiktokHandle}`,
      W - PAD * 2,
    ),
    W / 2,
    fy + 52,
  );
  ctx.fillStyle = '#999999';
  ctx.font = `10.5px ${SANS}`;
  ctx.fillText(ellipsis(ctx, biz.terms, W - PAD * 2), W / 2, fy + 72);

  /* ---- bottom strip ---- */
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, H - stripH, W, stripH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 11px ${SANS}`;
  ls(ctx, '2px');
  ctx.textAlign = 'center';
  ctx.fillText('JANNAT · CAIRO, EGYPT', W / 2, H - stripH / 2 + 4);
  ls(ctx, '0px');

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas export failed'))), 'image/png');
  });
}
