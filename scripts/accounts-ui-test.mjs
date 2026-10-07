import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.MULTIPLAYER_HTTP ?? 'http://127.0.0.1:8788/';
mkdirSync('.shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const username = `c_${randomUUID().replaceAll('-', '').slice(0, 18)}`;
const password = 'A phone commander test passphrase';
const newPassword = 'A changed phone commander passphrase';
async function setup(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  await page.getByText('Friend code').waitFor();
  return { context, page, account: page.locator('.online-account') };
}
async function enterLogin(player, passphrase) {
  await player.account.getByRole('button', { name: 'Sign in', exact: true }).click();
  await player.account.getByLabel('Username', { exact: true }).fill(username);
  await player.account.getByLabel('Password', { exact: true }).fill(passphrase);
  await player.account.getByRole('button', { name: 'Recover account', exact: true }).click();
}
async function assertLayout(page) {
  assert.equal(await page.locator('.online__panel').evaluateAll((elements) => elements.filter((e) => e.scrollWidth > e.clientWidth + 2).length), 0, 'cards must not overflow horizontally');
  assert(await page.locator('.online-account button, .online-account input').evaluateAll((elements) => elements.every((e) => e.getBoundingClientRect().height >= 43.9)), 'account controls need 44px touch targets');
}
try {
  const a = await setup({ width: 667, height: 375 });
  const offlineBefore = await a.page.evaluate(() => localStorage.getItem('aow.progress.v1'));
  const friendCode = await a.page.locator('.online__name + p strong').textContent();
  const tokenBefore = await a.page.evaluate(() => localStorage.getItem('aow.online.token.v1'));
  await a.account.getByRole('button', { name: 'Create account', exact: true }).click();
  await a.account.getByLabel('Username', { exact: true }).fill(username);
  await a.account.getByLabel('Password', { exact: true }).fill(password);
  await a.account.getByLabel('Confirm password', { exact: true }).fill('A different long passphrase');
  await a.account.getByRole('button', { name: 'Save account', exact: true }).click();
  assert.equal(await a.account.getByRole('alert').textContent(), 'Passwords do not match.');
  await assertLayout(a.page);
  await a.page.screenshot({ path: '.shots/account-create-phone.png' });
  await a.account.getByLabel('Confirm password', { exact: true }).fill(password);
  await a.account.getByRole('button', { name: 'Save account', exact: true }).click();
  await a.account.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
  assert.equal(await a.account.locator('strong').textContent(), username);
  assert.notEqual(await a.page.evaluate(() => localStorage.getItem('aow.online.token.v1')), tokenBefore);
  assert.equal(await a.page.locator('.online__name + p strong').textContent(), friendCode);
  assert.equal(await a.page.evaluate(() => localStorage.getItem('aow.progress.v1')), offlineBefore);

  const b = await setup({ width: 1024, height: 576 });
  await a.page.getByRole('button', { name: 'Ranked battle', exact: true }).click();
  await b.page.getByRole('button', { name: 'Ranked battle', exact: true }).click();
  await a.page.locator('.hud__versus').waitFor(); await b.page.locator('.hud__versus').waitFor();
  await b.page.getByRole('button', { name: 'Leave battle', exact: true }).click();
  await b.page.getByRole('button', { name: 'Forfeit', exact: true }).click();
  await a.page.locator('.online__result').getByRole('heading', { name: 'Victory', exact: true }).waitFor();
  await b.page.locator('.online__result').getByRole('heading', { name: 'Defeat', exact: true }).waitFor();
  await a.page.getByRole('button', { name: 'Close result' }).click();
  await b.page.getByRole('button', { name: 'Close result' }).click();
  assert.equal(await a.page.locator('.online-history__list li').count(), 1);
  assert.match(await a.page.locator('.online-history__list').textContent(), /1016 rating \(\+16\)/);
  await a.page.reload(); await a.page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  await a.account.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
  await a.page.locator('.online-history__list li').waitFor();
  assert.equal(await a.page.locator('.online__name + p strong').textContent(), friendCode);
  await a.page.locator('.online-history').scrollIntoViewIfNeeded();
  await a.page.screenshot({ path: '.shots/online-history-phone.png' });

  await enterLogin(b, 'An incorrect long test passphrase');
  await b.account.getByRole('alert').waitFor();
  assert.equal(await b.account.getByRole('alert').textContent(), 'Username or password is incorrect.');
  await b.account.getByLabel('Password', { exact: true }).fill(password);
  await b.account.getByRole('button', { name: 'Recover account', exact: true }).click();
  await b.account.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
  assert.equal(await b.page.locator('.online__name + p strong').textContent(), friendCode);
  assert.match(await b.page.locator('.online-history__list').textContent(), /1016 rating \(\+16\)/);
  assert.equal(await b.account.locator('input[type=password]').count(), 0, 'successful sign-in must remove password fields');
  await b.account.getByRole('button', { name: 'Change password' }).click();
  await b.account.getByLabel('Current password', { exact: true }).fill(password);
  await b.account.getByLabel('New password', { exact: true }).fill(newPassword);
  await b.account.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await assertLayout(b.page);
  await b.account.getByRole('button', { name: 'Update password' }).click();
  await b.account.getByText('Password changed. Previous device sessions are no longer valid.').waitFor();
  await b.account.getByRole('button', { name: 'Online data & privacy' }).click();
  await b.account.locator('.online-account__privacy').waitFor();
  await b.page.screenshot({ path: '.shots/account-privacy-desktop.png' });
  await b.account.getByRole('button', { name: 'Sign out', exact: true }).click();
  await b.account.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.notEqual(await b.page.locator('.online__name + p strong').textContent(), friendCode);
  assert.equal(await b.page.locator('.online-history__list li').count(), 0, 'signed-out guest must not retain account history');
  await enterLogin(b, password); await b.account.getByRole('alert').waitFor();
  await b.account.getByLabel('Password', { exact: true }).fill(newPassword);
  await b.account.getByRole('button', { name: 'Recover account', exact: true }).click();
  await b.account.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
  assert.equal(await b.page.locator('.online__name + p strong').textContent(), friendCode);
  await b.page.setViewportSize({ width: 667, height: 375 });
  await b.account.getByRole('button', { name: 'Change password' }).click();
  await assertLayout(b.page);
  await b.account.getByLabel('Current password', { exact: true }).scrollIntoViewIfNeeded();
  await b.page.screenshot({ path: '.shots/account-password-phone.png' });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Account UI passed: 667px phone forms, mismatch/wrong-password feedback, guest upgrade, ranked history, reload, second-device recovery, password change, logout and offline save isolation.');
} finally { await browser.close(); }
