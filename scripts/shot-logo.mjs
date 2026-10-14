import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.screenshot({ path: '/tmp/logo-check.png' });
const broken = await p.$$eval('img', (els) => els.filter((e) => e.naturalWidth === 0).map((e) => e.src));
console.log('broken images:', broken.length ? broken : 'none');
await b.close();
