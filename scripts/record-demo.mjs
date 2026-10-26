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

const W = 1440;
const H = 900;

const LINES = {
  intro: 'Quality Loop: closed-loop quality and learning for data-center delivery. Demo data, clearly labeled.',
  futures: 'Same project, two futures: closed loop OFF on the left, ON on the right.',
  earlier: 'Defects found earlier in design and site work cost far less than at commissioning.',
  day295: 'By day 295 the closed loop has fewer open issues and lower observed cost of poor quality.',
  handover: 'At handover: observed CoPQ and forecast schedule slip diverge. Estimated avoided cost is kept separate.',
  dashboard: 'Dashboard: every number is derived from the issue data and the editable assumptions.',
  issue: 'One issue worked through the loop: capture, triage, 5-Whys root cause, actions, verification.',
  closure: 'Closure needs completed actions and verification evidence, not just a status change.',
  actions: 'Action board: owners, due dates and overdue work are visible.',
  learning: 'Lessons feed back into design standards, so repeat issues are prevented in later phases.',
  outro: 'Closed loop: capture, root cause, verify, learn, prevent. Assumptions are editable; results are demo data.',
};

// Generate all narration first so nothing waits on the network while recording.
const clips = {};
let n = 0;
for (const [key, text] of Object.entries(LINES)) clips[key] = { text, ...(await synth(text, n++)) };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: tmp, size: { width: W, height: H } },
});
const page = await ctx.newPage();
const t0 = Date.now();

const caption = async (key, action) => {
  const { text, file, seconds } = clips[key];
  narration.push({ file, startMs: Date.now() - t0 });
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:1100px;z-index:9999;' +
        'background:rgba(15,23,42,.92);color:#fff;padding:12px 20px;border-radius:8px;font:600 19px system-ui;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  const total = Math.max(2500, seconds * 1000 + 700);
  await Promise.all([page.waitForTimeout(total), action ? action(total) : Promise.resolve()]);
};

const STEP_MS = 100;
const scrub = async (from, to, ms) => {
  const steps = Math.max(1, Math.floor(ms / STEP_MS));
  for (let i = 1; i <= steps; i++) {
    await page.locator('#day-range').fill(String(Math.round(from + ((to - from) * i) / steps)));
    await page.waitForTimeout(STEP_MS);
  }
};
const scrollTo = (y) => page.evaluate((top) => window.scrollTo({ top }), y);
// Slowly scroll the whole page so every part of the UI is on screen at some point.
const scrollThrough = async (ms) => {
  const steps = Math.max(1, Math.floor(ms / STEP_MS));
  for (let i = 1; i <= steps; i++) {
    await page.evaluate(
      ([f]) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * f),
      [i / steps],
    );
    await page.waitForTimeout(STEP_MS);
  }
};
const open = async (hash, day) => {
  await page.goto(`${base}/#/${hash}`);
  await page.locator('#day-range').fill(String(day));
  await scrollTo(0);
  await page.waitForTimeout(300);
};

await open('sim', 0);
await caption('intro');
await scrollTo(260);
await caption('futures', (ms) => scrub(0, 140, ms));
await caption('earlier', (ms) => scrub(140, 250, ms));
await caption('day295', (ms) => scrub(250, 295, ms));
await caption('handover', async (ms) => {
  await scrub(295, 360, ms * 0.4);
  await scrollThrough(ms * 0.6);
});

await open('dashboard', 295);
await caption('dashboard', scrollThrough);

await open('issue/I-017', 295);
await caption('issue');
await caption('closure', scrollThrough);

await open('actions', 295);
await caption('actions', scrollThrough);

await open('learning', 295);
await caption('learning', scrollThrough);

await open('sim', 360);
await scrollTo(260);
await caption('outro');

const video = page.video();
await ctx.close();
await browser.close();
const src = await video.path();
const webm = `${out}/quality-loop-demo.webm`;
renameSync(src, webm);
rmSync(tmp, { recursive: true, force: true });
const inputs = narration.flatMap((c) => ['-i', c.file]);
const delays = narration.map((c, i) => `[${i + 1}:a]adelay=${c.startMs}|${c.startMs}[a${i}]`).join(';');
const mix = narration.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${narration.length}:normalize=0[aout]`;
const r = spawnSync(
  'ffmpeg',
  ['-y', '-i', webm, ...inputs, '-filter_complex', `${delays};${mix}`, '-map', '0:v', '-map', '[aout]',
   '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', `${out}/quality-loop-demo.mp4`],
  { stdio: 'inherit' },
);
rmSync(audioDir, { recursive: true, force: true });
console.log('files:', readdirSync(out), 'ffmpeg exit', r.status);

