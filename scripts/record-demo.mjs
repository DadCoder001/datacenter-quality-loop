import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const out = 'demo-output';
const tmp = `${out}/raw`;
mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();

const caption = async (text, ms = 3500) => {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:1000px;z-index:9999;' +
        'background:rgba(15,23,42,.92);color:#fff;padding:12px 20px;border-radius:8px;font:600 18px system-ui;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(ms);
};

const scrub = async (from, to, stepMs = 40, step = 3) => {
  for (let d = from; d <= to; d += step) {
    await page.locator('#day-range').fill(String(d));
    await page.waitForTimeout(stepMs);
  }
  await page.locator('#day-range').fill(String(to));
};

await page.goto(`${base}/#/sim`);
await page.locator('#day-range').fill('0');
await caption('Quality Loop: closed-loop quality and learning for data-center delivery. Demo data, clearly labeled.', 4500);
await caption('Same project, two futures: closed loop OFF (left) vs ON (right).', 3000);
await scrub(0, 140);
await caption('Defects found earlier in design and site work cost far less than at commissioning.', 3500);
await scrub(140, 295);
await caption('By day 295 the closed loop has fewer open issues and lower observed cost of poor quality.', 4000);
await scrub(295, 360);
await caption('At handover: observed CoPQ and forecast schedule slip diverge. Estimated avoided cost is kept separate.', 4500);

await page.goto(`${base}/#/dashboard`);
await page.locator('#day-range').fill('295');
await caption('Dashboard: every number is derived from the issue data and the editable assumptions.', 4500);

await page.goto(`${base}/#/issue/I-017`);
await page.locator('#day-range').fill('295');
await caption('One issue worked through the loop: capture, triage, 5-Whys root cause, actions, verification.', 5500);
await page.mouse.wheel(0, 700);
await caption('Closure needs completed actions and verification evidence, not just a status change.', 4500);

await page.goto(`${base}/#/actions`);
await caption('Action board: owners, due dates and overdue work are visible.', 3500);

await page.goto(`${base}/#/learning`);
await caption('Lessons feed back into design standards, so repeat issues are prevented in later phases.', 5000);

await page.goto(`${base}/#/sim`);
await page.locator('#day-range').fill('360');
await caption('Closed loop: capture, root cause, verify, learn, prevent. Assumptions are editable; results are demo data.', 5500);

const video = page.video();
await ctx.close();
await browser.close();
const src = await video.path();
const webm = `${out}/quality-loop-demo.webm`;
renameSync(src, webm);
rmSync(tmp, { recursive: true, force: true });
const r = spawnSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', `${out}/quality-loop-demo.mp4`], { stdio: 'inherit' });
console.log('files:', readdirSync(out), 'ffmpeg exit', r.status);
