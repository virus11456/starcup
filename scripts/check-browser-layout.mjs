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

  // Reproduce the reported iPhone six-player crowding with ordinary UI
  // clicks only. No synthetic hand/cards, no phase mutation, no production IO.
  const phone = await context.newPage();
  await phone.setViewportSize({width:390,height:844});
  await phone.goto(base + '/full', { waitUntil: 'domcontentloaded' });
  await phone.waitForFunction(() => {
    const start = document.querySelector('.full-primary');
    return start && !start.disabled;
  }, null, {timeout:60000});
  await phone.locator('input[name="players"][value="6"]').check({force:true});
  await phone.locator('.full-primary').first().click();
  const f = phone.frameLocator('iframe.full-frame');
  await f.locator('#arena.choose-character .dialog .button.character').first()
    .waitFor({state:'visible',timeout:90000});
  // A visible seat-chooser on iPhone was cropped by the dialog and
  // the separate native 更換／自由選角 buttons. Verify they occupy
  // distinct regions and that offscreen seat buttons can be scrolled into view.
  const draftBefore=await f.locator('#arena.choose-character > .dialog:not(.popped)').evaluate(dialog => {
    const rect=el=>{ const r=el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}; };
    const arena=dialog.parentElement, controls=arena.querySelector(':scope > #control');
    const scroll=dialog.querySelector(':scope > .content-container');
    const seats=dialog.querySelector('table.add-setting');
    return {panel:rect(dialog),arena:rect(arena),controls:controls&&rect(controls),
      scroll:scroll&&{...rect(scroll),scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight},
      seats:seats&&rect(seats)};
  });
  if(!draftBefore.controls || !draftBefore.scroll ||
     draftBefore.panel.top < draftBefore.arena.top-3 ||
     draftBefore.panel.bottom > draftBefore.controls.top-4 ||
     draftBefore.scroll.bottom > draftBefore.panel.bottom+2)
    throw new Error('Phone draft gallery, seat row and action buttons overlap: '+JSON.stringify(draftBefore));
  const seats=f.locator('#arena.choose-character > .dialog table.add-setting .tdnode');
  if(await seats.count()>0) {
    await seats.last().evaluate(el=>el.scrollIntoView({block:'end',inline:'nearest'}));
    const visibleSeat=await seats.last().evaluate(el=>{
      const r=el.getBoundingClientRect();
      const d=el.closest('.dialog').getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,panelTop:d.top,panelBottom:d.bottom};
    });
    if(visibleSeat.top < visibleSeat.panelTop-3 || visibleSeat.bottom > visibleSeat.panelBottom+3)
      throw new Error('Final selectable seat remains cut off on phone: '+JSON.stringify(visibleSeat));
  }
  checks.push('390px phone draft: seat choices scroll fully inside panel; native change/free buttons stay below');
  await phone.screenshot({path:path.join(out,'phone-draft-seats-390x844.png'),fullPage:false});
  await f.locator('#arena.choose-character .dialog .button.character').first().click();
  const confirmation = f.locator('#control .control > div').filter({hasText:/確定|确定/}).first();
  if (await confirmation.isVisible({timeout:8000}).catch(() => false))
    await confirmation.click();
  await f.locator('#arena:not(.choose-character) > .player:not([data-position="0"])')
    .first().waitFor({state:'visible',timeout:50000});
  await phone.waitForTimeout(1300); // Allow 400ms HUD seat-fit update.
  const layout = await f.locator('#arena').evaluate(arena => {
    const roles = [...arena.querySelectorAll(':scope > .player:not([data-position="0"])')]
      .filter(el => getComputedStyle(el).display !== 'none')
      .map(el => {
        const r = el.getBoundingClientRect();
        return {id:el.dataset.position,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,
          width:r.width,height:r.height},scale:getComputedStyle(el).scale,cap:el.style.getPropertyValue('--grail-portrait-seat-scale')};
      });
    const intersects = [];
    for (let i=0;i<roles.length;i++) for(let j=i+1;j<roles.length;j++) {
      const a=roles[i].rect,b=roles[j].rect;
      const w = Math.min(a.right,b.right)-Math.max(a.left,b.left);
      const h = Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if (w>5 && h>5) intersects.push({pair:[roles[i].id,roles[j].id],w,h});
    }
    return {roles,intersects};
  });
  if (layout.roles.length !== 5 || layout.roles.some(role => !role.cap))
    throw new Error('Six-player iPhone layout not reconciled: '+JSON.stringify(layout));
  if (layout.intersects.length)
    throw new Error('Six-player iPhone roles overlap: '+JSON.stringify(layout));
  checks.push('natural six-player iPhone match: five opponent portraits separated with adaptive zoom');
  // A previous iPhone screenshot placed an anonymous "手牌 4/6" in the
  // middle of the battlefield, far from the owning bottom-left character.
  // Verify the LOCAL hand counter is instead visibly attached to that
  // same native portrait without reading or cloning anyone's hidden cards.
  const ownHand = await f.locator('#arena > .player[data-position="0"]').evaluate(player => {
    const card = player.getBoundingClientRect();
    const node = player.querySelector(':scope > .count:not(.hidden)');
    const rect = node?.getBoundingClientRect();
    return {
      pinned: player.dataset.grailOwnHandCountPinned,
      mirrored: player.dataset.grailHandCountMirror,
      aria: node?.getAttribute('aria-label'),
      value: node?.textContent?.trim(),
      visible: node && getComputedStyle(node).visibility === 'visible',
      role: { left:card.left, top:card.top, right:card.right },
      badge: rect && { left:rect.left, top:rect.top, bottom:rect.bottom, right:rect.right },
    };
  });
  if (ownHand.pinned !== 'true' || ownHand.mirrored !== 'false' ||
      !ownHand.visible || !ownHand.aria?.startsWith('我的手牌 ') ||
      !ownHand.badge || Math.abs(ownHand.badge.left-ownHand.role.left)>30 ||
      ownHand.badge.top < ownHand.role.top-85 ||
      ownHand.badge.bottom > ownHand.role.top+22) {
    throw new Error('The local hand badge is detached or has no owner: '+JSON.stringify(ownHand));
  }
  checks.push('390px phone: 我的手牌 count is pinned above its OWN native character, not floating mid-board');
  const mobileStats = f.locator('#grail-scoreboard');
  const detailToggle = f.locator('#grail-scoreboard .grail-score-toggle');
  const before = await detailToggle.evaluate(button => {
    const rect=button.getBoundingClientRect();
    const board=button.closest('#grail-scoreboard');
    const visible=(kind)=>getComputedStyle(board.querySelector('[data-kind="'+kind+'"]')).display!=='none';
    return {display:getComputedStyle(button).display,w:rect.width,h:rect.height,
      expanded:button.getAttribute('aria-expanded'),
      gems:visible('gems'),morale:visible('morale')};
  });
  if(before.display==='none'||before.w<43||before.h<43||before.expanded!=='false'||
     before.gems||!before.morale)
    throw new Error('Phone quick stats must be compact, readable and 44px touchable: '+JSON.stringify(before));
  await detailToggle.click();
  const opened=await mobileStats.evaluate(board=>({
    expanded:board.dataset.expanded,
    gems:getComputedStyle(board.querySelector('[data-kind="gems"]')).display,
    crystals:getComputedStyle(board.querySelector('[data-kind="crystals"]')).display,
  }));
  if(opened.expanded!=='true'||opened.gems==='none'||opened.crystals==='none')
    throw new Error('Full team statistics did not open: '+JSON.stringify(opened));
  await phone.screenshot({path:path.join(out,'game-6-players-full-score-390x844.png'),fullPage:false});
  await detailToggle.click();
  if(await detailToggle.getAttribute('aria-expanded')!=='false')
    throw new Error('Compact team statistics could not be restored');
  const shortHistory=f.locator('#grail-history-toggle');
  if(!(await shortHistory.getAttribute('data-mobile-label'))?.startsWith('紀錄'))
    throw new Error('Battle history lacks compact mobile label');
  checks.push('390px phone scoreboard: 44px expand button, full live details, compact log, collapsed return');
  await phone.screenshot({path:path.join(out,'game-6-players-iphone-390x844.png'),fullPage:false});
  await phone.close();
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
