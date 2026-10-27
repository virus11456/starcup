/* Headless Chromium acceptance for actual locally-built Worker.
 * Uses throwaway secrets and ephemeral local storage; never writes production.
 * Screenshots are audit evidence, not natural-game completion claims. */
import { unstable_dev } from 'wrangler';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('/tmp/starcup-visual-qa/package.json');
const { chromium } = require('playwright-core');
const browserBinary = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']
  .map(name => { try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { return ''; } })
  .find(Boolean);
if (!browserBinary) throw new Error('No Chromium/Google Chrome available for real viewport verification');
const password = 'starcup-qa-' + randomBytes(12).toString('hex');
const out = path.resolve('outputs/visual-qa');
await mkdir(out, { recursive: true });
let worker, browser, failed = false;
const checks = [];

async function verifyRoute(context, base, route, viewport) {
  const page = await context.newPage();
  const { width, height } = viewport;
  await page.setViewportSize(viewport);
  await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator(route === '/access' ? 'main' : '.site-header').waitFor({ timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  const state = await page.evaluate(() => {
    const shell = document.querySelector('.portal-mode, .knowledge-shell, .full-shell:not(.full-running), main[class*="page"]');
    const header = document.querySelector('.site-header');
    const actual = shell && getComputedStyle(shell);
    const bounding = shell?.getBoundingClientRect();
    return {
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth,
      shellWidth: bounding?.width,
      shellRight: bounding?.right,
      shellLeft: bounding?.left,
      backgroundImage: actual?.backgroundImage || '',
      backgroundColor: actual?.backgroundColor || '',
      headerRight: header?.getBoundingClientRect().right,
      headerLeft: header?.getBoundingClientRect().left,
    };
  });
  if (route !== '/access') {
    if (!state.backgroundImage.includes('radial-gradient'))
      throw new Error(route + ' missing shared dark gradient at ' + width + 'x' + height);
    if (state.shellWidth < width - 2 || state.shellRight < width - 2 || state.shellLeft > 2)
      throw new Error(route + ' outer shell letterboxed at ' + width + ': ' + JSON.stringify(state));
    if (state.headerRight > width + 3 || state.headerLeft < -3)
      throw new Error(route + ' header outside viewport: ' + JSON.stringify(state));
  }
  const slug = route === '/' ? 'home' : route.slice(1);
  await page.screenshot({ path: path.join(out, slug + '-' + width + 'x' + height + '.png'), fullPage: false });
  if (state.htmlScrollWidth > width + 3 || state.bodyScrollWidth > width + 3) {
    const offenders = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .map(node => ({node, rect: node.getBoundingClientRect()}))
      .filter(entry => entry.rect.right > innerWidth + 3 && entry.rect.width > 0)
      .sort((a,b) => b.rect.right - a.rect.right)
      .slice(0, 12)
      .map(({node,rect}) => ({tag:node.tagName,cls:typeof node.className === 'string' ? node.className.slice(0,90) : '',text:node.textContent?.trim().slice(0,38),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)})));
    throw new Error(route + ' horizontal overflow at ' + width + ': ' + JSON.stringify({state,offenders}));
  }
  checks.push(route + ' ' + width + 'x' + height + ': shared dark viewport / no overflow');
  await page.close();
}

try {
  worker = await unstable_dev('dist/server/index.js', {
    config: 'dist/server/wrangler.json', local: true, port: 0,
    inspectorPort: 0, persist: false, logLevel: 'error',
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
    vars: {
      SITE_ACCESS_PASSWORD: password,
      SITE_ACCESS_SESSION_SECRET: randomBytes(32).toString('hex'),
      GRAIL_SERVER_SECRET: randomBytes(32).toString('hex'),
    },
  });
  const address = worker.address;
  const base = 'http://' + (address.includes(':') ? '[' + address + ']' : address) + ':' + worker.port;
  browser = await chromium.launch({
    executablePath: browserBinary, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: {width:1440,height:900}, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const login = await context.newPage();
  await login.goto(base + '/access?next=%2F', { waitUntil: 'domcontentloaded' });
  await login.locator('#site-password').fill(password);
  await login.locator('button[type="submit"]').click();
  await login.waitForURL(url => url.pathname === '/', { timeout: 30000 });
  await login.close();
  for (const viewport of [
    {width:1440,height:900}, {width:390,height:844}, {width:844,height:390},
  ]) {
    for (const route of ['/', '/full', '/online', '/learn', '/rules', '/cards']) {
      await verifyRoute(context, base, route, viewport);
    }
  }
  const accessContext = await browser.newContext({viewport:{width:390,height:844}});
  await verifyRoute(accessContext, base, '/access', {width:390,height:844});
  await accessContext.close();

  // Safe native game-draft inspection; no synthetic game-state injection.
  const page = await context.newPage();
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base + '/full', { waitUntil: 'domcontentloaded' });
  await page.locator('.full-primary').first().waitFor({ state:'visible', timeout:45000 });
  await page.waitForFunction(() => {
    const start = document.querySelector('.full-primary');
    return start && !start.disabled;
  }, null, { timeout:60000 });
  await page.locator('.full-primary').first().click();
  await page.locator('iframe.full-frame').waitFor({ state:'visible', timeout:15000 });
  const frame = page.frameLocator('iframe.full-frame');
  await frame.locator('#window').waitFor({timeout:90000});
  await frame.locator('#system').waitFor({timeout:45000});
  await frame.locator('#grail-phase-hint').waitFor({state:'attached',timeout:45000});
  const hintIsInline = await frame.locator('#grail-phase-hint').evaluate(node =>
    node.parentElement?.classList?.contains('grail-score-heading'));
  if (!hintIsInline) throw new Error('Passive game phase hint is still a floating overlay');
  checks.push('native battle passive text attached to scoreboard, not floating above targets');

  // Exercise the shipped JS and CSS together without issuing synthetic
  // gameplay events. The diagnostic node is removed immediately.
  const damageProbe = await frame.locator('#window').evaluate(async () => {
    const { updateResponseCancelLabel } = await import('/engine/grail-response-labels.js');
    const parent = document.querySelector('#control');
    if (!parent) throw new Error('No native control container');
    const sample = document.createElement('div');
    sample.className = 'control';
    sample.style.opacity = '1';
    const button = document.createElement('div');
    button.link = 'cancel';
    button.textContent = '取消';
    sample.append(button);
    parent.append(sample);
    try {
      const before = button.offsetWidth;
      updateResponseCancelLabel(sample, { name:'yingZhan' }, '取消');
      const after = button.offsetWidth;
      const damage = {
        text: button.textContent,
        action: button.dataset.grailAction,
        link: button.link,
        before, after,
        width: Number.parseFloat(sample.style.width),
        scrollWidth: sample.scrollWidth,
        clientWidth: sample.clientWidth,
      };
      updateResponseCancelLabel(sample, {
        name:'gongJiOrFaShu', action:true,
        player:{storage:{gongJiOrFaShu:1,faShu:0,gongJi:0,extraXingDong:[]}},
      }, '取消');
      return {damage, turnText:button.textContent, turnLink:button.link};
    } finally { sample.remove(); }
  });
  const d = damageProbe.damage;
  if (d.text !== '承受傷害' || d.action !== 'damage' || d.link !== 'cancel' ||
      d.width < d.after - 1 || d.scrollWidth > d.clientWidth + 2 ||
      damageProbe.turnText !== '結束回合' || damageProbe.turnLink !== 'cancel') {
    throw new Error('Native response button labels clip/change semantics: '+JSON.stringify(damageProbe));
  }
  checks.push('shipped native damage / end-turn labels fit control width and keep click links');

  const running = await page.evaluate(() => ({
    wrapper: document.querySelector('main.full-running')?.getBoundingClientRect().toJSON(),
    width: innerWidth,
    iframe: document.querySelector('iframe.full-frame')?.getBoundingClientRect().toJSON(),
  }));
  if (running.wrapper.width < running.width - 2 || running.iframe.width < running.width - 2)
    throw new Error('Actual match iframe is letterboxed: '+ JSON.stringify(running));
  checks.push('native game iframe: full-width wrapper and system controls');
  await page.screenshot({path:path.join(out,'game-draft-1440x900.png'),fullPage:false});
  // Native Options must open on top of the HUD, including 新手嚮導.
  const nativeOptions = frame.locator('#system').getByText('選項', {exact:true}).first();
  await nativeOptions.click({timeout:15000});
  await frame.locator('#window > .menu-container:not(.hidden)').waitFor({timeout:15000});
  const menuState = await frame.locator('#window > .menu-container:not(.hidden)').evaluate(node => ({
    z: Number(getComputedStyle(node).zIndex),
    hudZ: Number(getComputedStyle(document.querySelector('#grail-hud')).zIndex),
    text: node.textContent?.slice(0,400) || '',
  }));
  if (menuState.z <= menuState.hudZ)
    throw new Error('Native settings/tutorial menu is behind HUD: '+JSON.stringify(menuState));
  checks.push('native Options and tutorial menu overlays scoreboard HUD');
  await page.screenshot({path:path.join(out,'game-options-1440x900.png'),fullPage:false});
  await page.close();
  await context.close();
  console.log('Browser visual QA PASS: ' + checks.length + ' checks');
  for (const check of checks) console.log('PASS ' + check);
} catch (error) {
  failed = true;
  console.error('Browser visual QA failed:', error);
} finally {
  await browser?.close();
  await worker?.stop();
  // Wrangler's optional background services otherwise prevent CI exit.
  process.exit(failed ? 1 : 0);
}
