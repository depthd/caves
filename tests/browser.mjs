import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.CAVES_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({
  executablePath: process.env.CAVES_CHROMIUM,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});

try {
  const page = await browser.newPage({viewport: {width: 1024, height: 680}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const mode = expected => page.waitForFunction(value => document.body.dataset.mode === value, expected);
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await mkdir('artifacts', {recursive: true});
  await page.goto(url);
  await mode('intro');
  await frames();
  await page.screenshot({path: 'artifacts/descent.png'});
  assert.equal(await page.locator('#fatal').isHidden(), true);

  await page.locator('#enter').click();
  await mode('walk');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#intro')).opacity === '0');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => Number(document.querySelector('#depth').textContent) > 42);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF');
  assert.equal(await page.locator('#toast').textContent(), 'Фонарь выключен');
  await page.keyboard.press('KeyF');
  await page.screenshot({path: 'artifacts/walk.png'});
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);

  await page.locator('#overview').click();
  await mode('orbit');
  await page.mouse.move(600, 380);
  await page.mouse.down();
  await page.mouse.move(700, 340, {steps: 4});
  await page.mouse.up();
  await frames();
  await page.screenshot({path: 'artifacts/overview.png'});
  await page.locator('#help').click();
  assert.equal(await page.locator('#help-dialog').isVisible(), true);
  await page.locator('#close-help').click();
  await page.locator('#home').click();
  await mode('intro');
  await page.locator('#regenerate').click();
  await mode('intro');
  assert.notEqual(await page.locator('#seed').inputValue(), 'CHASM-014');
  await page.locator('#seed').fill('CHASM-014');
  await page.locator('#seed').press('Enter');
  assert.equal(new URL(page.url()).searchParams.get('seed'), 'CHASM-014');

  await page.locator('#tour').click();
  await mode('tour');
  await page.waitForFunction(() => document.body.dataset.mode === 'walk' && document.querySelector('#depth').textContent === '92', null, {timeout: 90_000});
  assert.equal(await page.locator('#zone').textContent(), 'Кристальный грот');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => Number(document.querySelector('#depth').textContent) < 92);
  await page.locator('#prompt').waitFor({state: 'visible'});
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('#samples').textContent === '1 / 3');
  assert.equal(await page.locator('#samples').textContent(), '1 / 3');

  assert.deepEqual(errors, []);
  console.log('Chromium: intro, walking, flashlight, pointer release, orbit, help, seed, full tour, return and sample collection passed.');
} finally {
  await browser.close();
}
