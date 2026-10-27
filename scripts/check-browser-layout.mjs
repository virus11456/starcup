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

  // Real mobile Chromium context (touch events + high DPR), not a desktop
  // page merely resized to 390px. This probes the previously untested
  // iPhone-like CSS visual viewport, including short four-player scenes.
  const mobileContext = await browser.newContext({
    viewport:{width:375,height:667},deviceScaleFactor:3,
    isMobile:true,hasTouch:true,locale:'zh-TW',reducedMotion:'reduce',
  });
  const authPage=await mobileContext.newPage();
  await authPage.goto(base+'/access?next=%2F',{waitUntil:'domcontentloaded'});
  await authPage.locator('#site-password').fill(password);
  await authPage.locator('button[type="submit"]').tap({force:true});
  await authPage.waitForURL(u=>u.pathname==='/',{timeout:30000});
  await authPage.close();

  for(const scenario of [{players:4,width:375,height:667},{players:6,width:430,height:932}]) {
    const p=await mobileContext.newPage();
    await p.setViewportSize({width:scenario.width,height:scenario.height});
    const sceneName='mobile-touch-'+scenario.players+'p-'+scenario.width+'x'+scenario.height;
    try {
      await p.goto(base+'/full',{waitUntil:'domcontentloaded'});
      await p.waitForFunction(()=> {
        const btn=document.querySelector('.full-primary');
        return btn&&!btn.disabled;
      },null,{timeout:60000});
      await p.locator('input[name="players"][value="'+scenario.players+'"]').check({force:true});
      await p.locator('.full-primary').first().tap({force:true});
      const game=p.frameLocator('iframe.full-frame');
      const draft=game.locator('#arena.choose-character .dialog .button.character').first();
      await draft.waitFor({state:'attached',timeout:90000});
      await draft.tap({force:true});
      const confirm=game.locator('#control .control > div').filter({hasText:/確定|确定/}).first();
      if(await confirm.isVisible().catch(()=>false)) await confirm.tap({force:true});
      try {
        await game.locator('#arena:not(.choose-character) > .player:not([data-position="0"])')
          .first().waitFor({state:'attached',timeout:25000});
      } catch(error) {
        const diagnosis=await game.locator('#window').evaluate(root=>({
          screen:{innerWidth,innerHeight,dpr:devicePixelRatio,
            visual:window.visualViewport&&{
              width:visualViewport.width,height:visualViewport.height,
              scale:visualViewport.scale,offsetTop:visualViewport.offsetTop}},
          arenaClass:root.querySelector('#arena')?.className,
          dialogText:root.querySelector('#arena .dialog')?.textContent?.trim().slice(0,180),
          controls:[...root.querySelectorAll('#control .control > div')]
            .map(node=>({text:node.textContent?.trim(),cls:node.className})),
          selectedDraft:[...root.querySelectorAll('#arena .dialog .button.character.selected')].length,
        }));
        await p.screenshot({path:path.join(out,sceneName+'-selection-debug.png'),fullPage:false});
        throw new Error('Mobile touch character selection did not finish: '+JSON.stringify(diagnosis)+' / '+error.message);
      }
      await p.waitForTimeout(1400);
      const layout=await game.locator('#arena').evaluate(arena=>{
        const rect=el=>{
          const r=el.getBoundingClientRect();
          return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height};
        };
        const roles=[...arena.querySelectorAll(':scope > .player:not([data-position="0"])')]
          .filter(el=>getComputedStyle(el).display!=='none')
          .map(el=>({id:el.dataset.position,role:rect(el),
            identity:el.querySelector('.identity')?rect(el.querySelector('.identity')):null,
            cap:el.style.getPropertyValue('--grail-portrait-seat-scale')}));
        const chips=[...document.querySelectorAll('#grail-player-indicators .grail-player-indicator-strip')]
          .filter(el=>el.getClientRects().length)
          .map(el=>({name:el.getAttribute('aria-label'),rect:rect(el)}));
        const intersects=(a,b)=>a&&b&&
          Math.min(a.r,b.r)-Math.max(a.l,b.l)>5&&
          Math.min(a.b,b.b)-Math.max(a.t,b.t)>5;
        const overlaps=[];
        for(let i=0;i<roles.length;i++) for(let j=i+1;j<roles.length;j++)
          if(intersects(roles[i].role,roles[j].role))
            overlaps.push(['roles',roles[i].id,roles[j].id]);
        for(const chip of chips) for(const role of roles)
          if(intersects(chip.rect,role.role))
            overlaps.push(['badge/role',chip.name,role.id]);
        const board=document.querySelector('#grail-scoreboard');
        const score=board&&rect(board);
        for(const role of roles) if(intersects(score,role.role))
          overlaps.push(['score/role',role.id]);
        return {roles,chips,score,overlaps,viewport:{
          innerWidth,innerHeight,dpr:devicePixelRatio,
          visual:visualViewport&&{width:visualViewport.width,height:visualViewport.height,
            scale:visualViewport.scale,offsetTop:visualViewport.offsetTop}}};
      });
      await p.screenshot({path:path.join(out,sceneName+'.png'),fullPage:false});
      if(layout.roles.length!==scenario.players-1 || layout.overlaps.length)
        throw new Error('Mobile touch portrait/HUD collision: '+JSON.stringify(layout));
      checks.push(sceneName+': live combat cards and public indicators do not overlap');
    } finally {await p.close();}
  }
  await mobileContext.close();
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
