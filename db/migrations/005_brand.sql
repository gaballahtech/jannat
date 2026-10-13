-- Jannat rebrand: new WhatsApp, TikTok, no Instagram, JANNAT10 promo.
insert into settings (key, value, updated_at) values
  ('biz', '{"address":"Cairo, Egypt","paymentDefault":"Online transfer","terms":"Payment due on receipt. Please check your items on delivery.","whatsapp":"201229081831","instagram":"","tiktok":"https://www.tiktok.com/@2jannat.samy1","shippingFee":70,"promoCode":"JANNAT10","promoPercent":10,"promoEnabled":true}', now())
on conflict (key) do update set value = excluded.value, updated_at = now();
