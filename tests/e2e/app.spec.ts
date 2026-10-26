import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEFAULT_ASSUMPTIONS } from '../../src/domain/project';
import { actionStats, isHighRisk, isOpen, totalCost, visibleIssues } from '../../src/domain/metrics';
import { materialize } from '../../src/data/materialize';
import { stateAt, baselineDataset } from '../../src/sim/engine';

const setDay = async (page: Page, day: number) => {
  await page.locator('#day-range').fill(String(day));
  await expect(page.getByTestId('header-day')).toContainText(`${day} ·`);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/#/sim');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('simulation plays forward and the two scenarios diverge', async ({ page }) => {
  await setDay(page, 100);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(async () => Number(await page.locator('[data-testid="day-readout"] strong').innerText())).toBeGreaterThan(105);
  await page.getByRole('button', { name: 'Pause' }).click();

  await setDay(page, 360);
  await expect(page.locator('[data-kpi="off-reported"]')).toContainText('24 / 5');
  await expect(page.locator('[data-kpi="on-reported"]')).toContainText('21 / 0');
  const on = stateAt(materialize('on'), 360, DEFAULT_ASSUMPTIONS);
  const off = stateAt(baselineDataset(), 360, DEFAULT_ASSUMPTIONS);
  expect(on.copqTotal).toBeLessThan(off.copqTotal);
  await expect(page.locator('[data-kpi="avoided"]')).toContainText('$2.04M');
});

test('scrubbing to a day equals playing state at that day (step controls)', async ({ page }) => {
  await setDay(page, 200);
  const direct = await page.locator('[data-kpi="on-copq"]').innerText();
  await setDay(page, 0);
  for (let i = 0; i < 40; i += 1) await page.getByRole('button', { name: 'Step forward 5 days' }).click();
  await expect(page.getByTestId('day-readout')).toContainText('200');
  expect(await page.locator('[data-kpi="on-copq"]').innerText()).toBe(direct);
});

test('clicking a simulation marker opens the matching issue', async ({ page }) => {
  await setDay(page, 295);
  const marker = page.getByTestId('scene-on').locator('.iso-marker').first();
  const id = await marker.getAttribute('data-issue');
  await marker.click();
  await expect(page.getByTestId('issue-workspace')).toHaveAttribute('data-issue-id', id as string);
});

test('changing an assumption changes results and reset restores them', async ({ page }) => {
  await setDay(page, 360);
  const kpi = page.locator('[data-kpi="off-copq"]');
  const before = await kpi.innerText();
  await page.locator('#mult-commissioning').fill('22');
  await expect(kpi).not.toHaveText(before);
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(async () => expect(await kpi.innerText()).toBe(before)).toPass();
});

test('full closed loop: capture, triage, root cause, actions, verify, lesson', async ({ page }) => {
  await page.goto('/#/register');
  await setDay(page, 295);
  await page.getByRole('button', { name: '+ Report issue' }).click();
  await page.getByLabel('Title').fill('Torque defects on UPS output breakers');
  await page.getByLabel('Issue family').fill('Termination & torque');
  await page.getByRole('button', { name: 'Report issue', exact: true }).click();

  const ws = page.getByTestId('issue-workspace');
  await expect(ws).toContainText('U-001');
  await expect(ws).toContainText('Reported');
  await page.getByRole('button', { name: 'Triage and start investigation' }).click();

  await page.getByLabel('Why 1?').fill('Crew skipped torque verification.');
  await page.getByLabel('Why 2?').fill('No independent audit before energization.');
  await page.getByLabel('Root cause statement').fill('No independent torque audit gate.');
  await page.getByRole('button', { name: 'Save root cause' }).click();

  await expect(page.getByText('Complete all actions to enable verification.')).toBeVisible();
  await page.getByLabel('Action', { exact: true }).fill('Re-torque all breaker terminations');
  await page.getByRole('button', { name: 'Add action' }).click();
  await expect(page.getByRole('button', { name: 'Verify and close' })).toHaveCount(0);
  await page.getByTestId('issue-actions').getByRole('button', { name: 'Mark done' }).click();

  await page.getByLabel('Verification evidence').fill('Re-inspected with calibrated tool; all within spec.');
  await page.getByRole('button', { name: 'Verify and close' }).click();
  await expect(ws).toContainText('Verified closed');

  await page.getByLabel('Lesson title').fill('Audit torque before energization');
  await page.getByLabel('What to do differently').fill('Witness 10% of terminations with calibrated tools.');
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await expect(ws).toContainText('Lesson captured');

  await page.getByRole('link', { name: 'Learning' }).click();
  await expect(page.getByTestId('lessons')).toContainText('Audit torque before energization');
});

test('workflow guards: verification is blocked until actions are done and fields are required', async ({ page }) => {
  await page.goto('/#/issue/I-017');
  await setDay(page, 295);
  await expect(page.getByText('Complete all actions to enable verification.')).toBeVisible();
  await page.goto('/#/register');
  await page.getByRole('button', { name: '+ Report issue' }).click();
  await page.getByRole('button', { name: 'Report issue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a short title');
});

test('register filters and sorting', async ({ page }) => {
  await page.goto('/#/register');
  await setDay(page, 295);
  const rows = page.locator('[data-testid="register-table"] tbody tr');
  const all = await rows.count();
  expect(all).toBe(visibleIssues(materialize('on').issues, 295).length);
  await page.getByLabel('Filter by severity').selectOption('critical');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Filter by severity').selectOption('all');
  await page.getByLabel('Filter by status').selectOption('open');
  const open = visibleIssues(materialize('on').issues, 295).filter((i) => isOpen(i, 295)).length;
  await expect(rows).toHaveCount(open);
  await page.getByRole('searchbox').fill('zzz-no-match');
  await expect(page.getByText('No issues match these filters')).toBeVisible();
});

test('dashboard numbers match the metric functions', async ({ page }) => {
  await page.goto('/#/dashboard');
  await setDay(page, 295);
  const ds = materialize('on');
  const vis = visibleIssues(ds.issues, 295);
  const open = vis.filter((i) => isOpen(i, 295));
  const stats = actionStats(ds.actions, 295);
  await expect(page.locator('[data-kpi="open"] .kpi-value')).toHaveText(String(open.length));
  await expect(page.locator('[data-kpi="highrisk"] .kpi-value')).toHaveText(String(open.filter(isHighRisk).length));
  await expect(page.locator('[data-kpi="overdue"] .kpi-value')).toHaveText(String(stats.overdue));
  const copq = totalCost(stateAt(ds, 295, DEFAULT_ASSUMPTIONS).copq);
  const shown = await page.locator('[data-kpi="copq"] .kpi-value').innerText();
  expect(shown).toBe(copq >= 1_000_000 ? `$${(copq / 1_000_000).toFixed(2)}M` : `$${Math.round(copq / 1000)}k`);
});

test('action board lets an owner complete an overdue action', async ({ page }) => {
  await page.goto('/#/actions');
  await setDay(page, 295);
  const overdue = page.getByTestId('col-overdue').locator('li');
  const before = await overdue.count();
  expect(before).toBeGreaterThan(0);
  await overdue.first().getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('heading', { name: `Overdue (${before - 1})` })).toBeVisible();
});

test('demo video page serves a playable video', async ({ page }) => {
  await page.goto('/#/video');
  const video = page.getByTestId('demo-video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
});

for (const route of ['sim', 'dashboard', 'register', 'issue/I-017', 'actions', 'learning', 'video']) {
  test(`accessibility: no serious violations on #/${route}`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await setDay(page, 295);
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  });
}
