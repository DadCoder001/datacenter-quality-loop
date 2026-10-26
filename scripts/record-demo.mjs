import { chromium } from '@playwright/test';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const out = 'demo-output';
const tmp = `${out}/raw`;
const audioDir = `${out}/audio`;
const VOICE = process.env.TTS_VOICE ?? 'en-US-AndrewMultilingualNeural';
mkdirSync(tmp, { recursive: true });
mkdirSync(audioDir, { recursive: true });

const narration = [];
let t0 = 0;

const durationOf = (file) =>
  Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout.toString());

// Neural voice via the Microsoft Edge read-aloud service (caption text is sent to Microsoft).
const synth = async (text, index) => {
  const dir = `${audioDir}/n${index}`;
  mkdirSync(dir, { recursive: true });
  for (let attempt = 1; ; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioFilePath } = await tts.toFile(dir, text);
      return { file: audioFilePath, seconds: durationOf(audioFilePath) };
    } catch (e) {
      if (attempt >= 3) throw e;
    } finally {
      tts.close();
    }
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
t0 = Date.now();

const caption = async (text, ms = 3500) => {
  const { file, seconds } = await synth(text, narration.length);
  narration.push({ file, startMs: Date.now() - t0 });
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
  await page.waitForTimeout(Math.max(ms, seconds * 1000 + 600));
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
const inputs = narration.flatMap((n) => ['-i', n.file]);
const delays = narration.map((n, i) => `[${i + 1}:a]adelay=${n.startMs}|${n.startMs}[a${i}]`).join(';');
const mix = narration.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${narration.length}:normalize=0[aout]`;
const r = spawnSync(
  'ffmpeg',
  ['-y', '-i', webm, ...inputs, '-filter_complex', `${delays};${mix}`, '-map', '0:v', '-map', '[aout]',
   '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', `${out}/quality-loop-demo.mp4`],
  { stdio: 'inherit' },
);
rmSync(audioDir, { recursive: true, force: true });
console.log('files:', readdirSync(out), 'ffmpeg exit', r.status);
