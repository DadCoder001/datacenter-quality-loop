import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const shot = async (name, hash, day = 295, setup) => {
  await page.goto(`${base}/#/${hash}`);
  await page.locator('#day-range').fill(String(day));
  if (setup) await setup();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log('saved', name);
};

await shot('01-simulation-day-295', 'sim');
await shot('02-simulation-day-140', 'sim', 140);
await shot('03-simulation-day-360', 'sim', 360);
await shot('04-dashboard', 'dashboard');
await shot('05-register', 'register');
await shot('06-issue-workspace', 'issue/I-017');
await shot('07-actions', 'actions');
await shot('08-learning', 'learning');
await browser.close();
