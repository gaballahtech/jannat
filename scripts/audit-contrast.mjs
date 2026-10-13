/* Automated dark/light contrast proof for jannat.
   Serves the production build, visits every route in both color schemes,
   runs axe-core's color-contrast rule, and saves dark screenshots.
   Exit 1 on any violation. Usage: node scripts/audit-contrast.mjs */
import { spawn } from 'node:child_process';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

function startPreview() {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    p.on('error', reject);
    const t0 = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(`${BASE}/`);
        if (res.ok) return resolve(p);
      } catch {
        /* not up yet */
      }
      if (Date.now() - t0 > 30000) {
        reject(new Error('preview did not start'));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

const failures = [];
let checks = 0;

async function check(page, name, scheme) {
  checks++;
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const bad = results.violations.flatMap((v) =>
    v.nodes.map((n) => ({ target: n.target.join(' '), text: (n.html || '').slice(0, 120) })),
  );
  if (bad.length > 0) {
    failures.push({ name, scheme, bad });
    console.log(`FAIL ${name} [${scheme}] — ${bad.length} nodes`);
    for (const b of bad.slice(0, 8)) console.log(`   ${b.target} :: ${b.text}`);
  } else {
    console.log(`PASS ${name} [${scheme}]`);
  }
}

async function shot(page, name, scheme) {
  await page.screenshot({ path: `/tmp/dark-${name}-${scheme}.png` });
}

async function unlockAdmin(page) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/password/i).first().waitFor({ timeout: 10000 });
  const setup = await page.getByPlaceholder('New password').count();
  if (setup > 0) {
    await page.getByPlaceholder('New password').fill('audit-pass-123');
    await page.getByPlaceholder('Confirm password').fill('audit-pass-123');
    await page.getByRole('button', { name: 'CREATE & UNLOCK' }).click();
  } else {
    await page.getByPlaceholder('Password').fill('audit-pass-123');
    await page.getByRole('button', { name: 'UNLOCK' }).click();
  }
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 8000 });
}

const browser = await chromium.launch();
try {
  const server = await startPreview();
  try {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();

      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await check(page, 'home', scheme);
      // bag drawer open
      await page.getByRole('button', { name: 'Bag', exact: true }).click();
      await page.waitForTimeout(600);
      await check(page, 'home+bag', scheme);
      await page.keyboard.press('Escape');
      if (scheme === 'dark') await shot(page, 'home', scheme);

      await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle' });
      await check(page, 'shop', scheme);

      await page.goto(`${BASE}/product/utility-hoodie`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(600);
      await check(page, 'product+sticky', scheme);
      if (scheme === 'dark') await shot(page, 'product', scheme);

      await page.goto(`${BASE}/search?q=hoodie`, { waitUntil: 'networkidle' });
      await check(page, 'search', scheme);

      await page.goto(`${BASE}/shop/saved`, { waitUntil: 'networkidle' });
      await check(page, 'saved', scheme);

      await page.goto(`${BASE}/nope`, { waitUntil: 'networkidle' });
      await check(page, '404', scheme);

      // admin: gate then all tabs (fresh context = locked)
      await unlockAdmin(page);
      for (const tab of ['overview', 'products', 'categories', 'homepage', 'invoices']) {
        await page.goto(`${BASE}/admin/${tab}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        await check(page, `admin-${tab}`, scheme);
      }
      if (scheme === 'dark') {
        await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle' });
        await shot(page, 'admin-products', scheme);
        await page.goto(`${BASE}/admin/overview`, { waitUntil: 'networkidle' });
        await shot(page, 'admin-overview', scheme);
      }
      await ctx.close();
    }

    // mobile dark: home + product + admin overview
    const mctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mp = await mctx.newPage();
    await mp.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await check(mp, 'm-home', 'dark-mobile');
    // open mobile menu
    await mp.getByRole('button', { name: 'Open menu' }).click();
    await mp.waitForTimeout(400);
    await check(mp, 'm-menu', 'dark-mobile');
    await shot(mp, 'm-menu', 'dark-mobile');
    await mctx.close();
  } finally {
    server.kill();
  }
} finally {
  await browser.close();
}

console.log(`\n${checks - failures.length}/${checks} page-checks clean`);
if (failures.length > 0) {
  console.log('VIOLATIONS REMAIN — see above');
  process.exit(1);
}
console.log('ALL CLEAN');
