import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const captures=path.resolve(import.meta.dirname,'../../docs/capturas');fs.mkdirSync(captures,{recursive:true});
const defaultSettings={name:'Mesa de prueba',target:200,turnSeconds:0,difficulty:'intermediate',environment:'courtyard',bonus:25,quickMessages:true};
async function fixture(page) {
  let moves=0;
  const s={revision:10,sessionId:'fixture',accepted:true,configured:true,settings:defaultSettings,handNumber:1,turn:0,error:null,hand:[{a:2,b:5},{a:3,b:5},{a:4,b:4},{a:0,b:1},{a:1,b:2},{a:3,b:6},{a:0,b:0}],counts:[7,7,7,7],chain:[{left:2,right:5}],moves:[{a:2,b:5,end:'left'},{a:2,b:5,end:'right'},{a:3,b:5,end:'right'},{a:1,b:2,end:'left'}],scores:[0,0],wins:[0,0],events:[],result:null,deadline:null,serverNow:new Date().toISOString()};
  await page.route('**/api/game',r=>r.fulfill({json:s}));
  await page.route('**/api/play',async r=>{moves++;await new Promise(resolve=>setTimeout(resolve,250));const cmd=r.request().postDataJSON();s.revision++;s.hand=s.hand.filter(t=>t.a!==cmd.a||t.b!==cmd.b);s.counts[0]--;s.turn=1;s.moves=[];s.chain=cmd.end==='left'?[{left:5,right:2},...s.chain]:[...s.chain,{left:5,right:2}];await r.fulfill({json:s});});
  await page.goto('/');await page.locator('#resume').click();await expect(page.locator('body')).not.toHaveClass(/outside-game/);await expect(page.locator('#fatal')).toBeHidden();
  return {state:s,moves:()=>moves};
}
async function select(page,key){await page.locator(`[data-tile="${key}"]`).click();await expect(page.locator(`[data-tile="${key}"]`)).toHaveClass(/selected/);}
test('tocar ambas puntas, cambiar/cancelar, inválida, confirmación y doble envío',async({page})=>{
  const f=await fixture(page);await select(page,'4:4');await expect(page.locator('#world-left')).toBeHidden();await expect(page.locator('#world-right')).toBeHidden();
  await select(page,'2:5');await expect(page.locator('#world-left')).toBeVisible();await expect(page.locator('#world-right')).toBeVisible();
  await page.locator('#cancel').click();await expect(page.locator('.tile.selected')).toHaveCount(0);expect(f.moves()).toBe(0);
  await page.locator('#settings').click();await page.locator('#confirm-setting').check();await page.locator('#close-settings').click();await select(page,'2:5');
  await page.locator('#world-left').click();await expect(page.locator('#confirmation')).toBeVisible();expect(f.moves()).toBe(0);await page.locator('#confirm-cancel').click();
  await select(page,'2:5');await page.locator('#world-right').click();await page.locator('#confirm').evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>f.moves()).toBe(1);await expect(page.locator('[data-tile="2:5"]')).toHaveCount(0);await expect(page.locator('#hand button:not(:disabled)')).toHaveCount(0);
});
test('arrastrar fuera cancela; arrastrar al destino ejecuta una sola jugada',async({page})=>{
  const f=await fixture(page);const tile=page.locator('[data-tile="2:5"]');let b=await tile.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(35,480,{steps:8});await page.mouse.up();
  await expect(page.locator('.tile.selected')).toHaveCount(0);expect(f.moves()).toBe(0);
  await select(page,'2:5');const target=await page.locator('#world-right').boundingBox();b=await tile.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12});await page.mouse.up();
  await expect.poll(()=>f.moves()).toBe(1);
});
test('cámara con botón derecho, límites, tablero y preferencias persistentes',async({page})=>{
  await fixture(page);const before=await page.evaluate(()=>patioDiagnostics().camera);
  await page.mouse.move(450,470);await page.mouse.down({button:'right'});await page.mouse.move(620,450,{steps:9});await page.mouse.up({button:'right'});
  const after=await page.evaluate(()=>patioDiagnostics().camera);expect(after.yaw).not.toBe(before.yaw);expect(Math.abs(after.yaw)).toBeLessThanOrEqual(.14);expect(await page.evaluate(()=>patioDiagnostics().opponentFaces)).toBe(0);
  await page.locator('#camera-table').click();await expect(page.locator('#camera-table')).toHaveAttribute('aria-pressed','true');await page.locator('#camera-reset').click();await expect(page.locator('#camera-table')).toHaveAttribute('aria-pressed','false');
  await page.locator('#settings').click();await page.locator('#invert-y').check();await page.locator('#quality').selectOption('low');await page.locator('#confirm-setting').check();await page.locator('#close-settings').click();
  await page.reload();await page.locator('#home-settings').click();await expect(page.locator('#invert-y')).toBeChecked();await expect(page.locator('#quality')).toHaveValue('low');await expect(page.locator('#confirm-setting')).toBeChecked();
});
test('PC: inicio, configuración, sala, mano real, resultado, siguiente mano y refresco',async({page})=>{
  // A whole hand at 1440×900 under software WebGL (SwiftShader, no GPU) renders the PBR table at ~1-2 FPS.
  test.setTimeout(480000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#home-create').click();
  await page.locator('#table-name').fill('Patio verificado');await page.locator('#table-target').selectOption('100');await page.locator('#table-difficulty').selectOption('hard');await page.locator('#table-environment').selectOption('terrace');await page.locator('#create-table').click();
  await expect(page.locator('#lobby-name')).toHaveText('Patio verificado');await expect(page.locator('#lobby-summary')).toContainText('Meta 100');await page.locator('#ready').click();
  await expect(page.locator('body')).not.toHaveClass(/outside-game/);await expect(page.locator('#fatal')).toBeHidden();
  let count=0,captured=false;
  while(count++<100) {
    if(await page.locator('#result').isVisible())break;
    const tile=page.locator('.tile.playable:not(:disabled)').first();
    if(await tile.count()) {
      await tile.click();const end=page.locator('.end-marker:not([hidden])').first();await end.waitFor({state:'visible'});
      if(!captured){await page.screenshot({path:path.join(captures,'pc-partida.png')});captured=true;}
      await end.click();
    }
    await page.waitForTimeout(550);
  }
  await expect(page.locator('#result')).toBeVisible();await page.screenshot({path:path.join(captures,'pc-resultado.png')});await page.locator('#next').click();
  await expect(page.locator('#result')).toBeHidden();await page.reload();await expect(page.locator('#resume')).toBeVisible();await page.locator('#resume').click();await expect(page.locator('.scoreboard .target')).toHaveText('A 100 PUNTOS');await expect(page.locator('body')).not.toHaveClass(/outside-game/);await expect.poll(()=>page.evaluate(()=>typeof window.patioDiagnostics)).toBe('function');
  const metrics=await page.evaluate(()=>patioDiagnostics());fs.writeFileSync(path.join(captures,'rendimiento-pc.json'),JSON.stringify(metrics,null,2));expect(errors).toEqual([]);
});
test('móvil táctil: tocar, cámara, vertical/horizontal y controles dentro de pantalla',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();await fixture(page);
  await page.locator('[data-tile="2:5"]').tap();await expect(page.locator('#world-left')).toBeVisible();await page.screenshot({path:path.join(captures,'movil-vertical.png')});
  const button=await page.locator('#world-right').boundingBox();expect(button.x).toBeGreaterThanOrEqual(0);expect(button.x+button.width).toBeLessThanOrEqual(390);
  await page.locator('#cancel').tap();await page.setViewportSize({width:844,height:390});await page.locator('[data-tile="2:5"]').tap();await page.screenshot({path:path.join(captures,'movil-horizontal.png')});
  const hand=await page.locator('#hand').boundingBox();expect(hand.x).toBeGreaterThanOrEqual(0);expect(hand.x+hand.width).toBeLessThanOrEqual(844);await page.locator('#world-right').tap();
  await expect(page.locator('[data-tile="2:5"]')).toHaveCount(0);await context.close();
});
test('capturas y medición de práctica real en móvil emulado',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();
  await page.goto('/');await expect(page.locator('#home-practice')).toBeVisible();await page.waitForFunction(()=>typeof window.patioDiagnostics==='function');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(captures,'movil-inicio-real.png')});await page.locator('#home-practice').tap();await page.locator('#ready').tap();await page.waitForTimeout(6500);
  await page.screenshot({path:path.join(captures,'movil-partida-real.png')});await page.locator('#camera-table').tap();await page.waitForTimeout(1000);await page.screenshot({path:path.join(captures,'movil-tablero-real.png')});
  await page.setViewportSize({width:844,height:390});await page.locator('#camera-reset').tap();await page.waitForTimeout(1500);await page.screenshot({path:path.join(captures,'movil-horizontal-real.png')});
  const metrics=await page.evaluate(()=>patioDiagnostics());fs.writeFileSync(path.join(captures,'rendimiento-movil-emulado.json'),JSON.stringify(metrics,null,2));await expect(page.locator('#fatal')).toBeHidden();await context.close();
});
test('pareja, reglas de la casa, aviso de cambios, silencio persistente y salida de la sala',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#home-create').click();
  await page.locator('#table-partner').selectOption('luis');await page.locator('#house-rules summary').click();
  await page.locator('#rule-counting').selectOption('opponents');await page.locator('#rule-capicua').uncheck();await expect(page.locator('#rules-badge')).toContainText('variantes');
  await page.locator('#create-table').click();await expect(page.locator('#lobby-seats .seat-card')).toHaveCount(4);
  await expect(page.locator('#lobby-seats .seat-card').nth(2)).toContainText('Luis · tu pareja');await expect(page.locator('#lobby-summary')).toContainText('pareja perdedora');await expect(page.locator('#lobby-summary')).toContainText('paso corrido, pase de salida');
  await page.locator('#edit-table').click();await expect(page.locator('#table-partner')).toHaveValue('luis');await page.locator('#table-target').selectOption('150');await page.locator('#create-table').click();
  await expect(page.locator('#lobby-notice')).toContainText('Condiciones actualizadas: meta');
  await page.locator('#leave-lobby').click();await expect(page.locator('#screen-home')).toBeVisible();await expect(page.locator('#resume')).toBeHidden();
  await page.locator('#home-create').click();await expect(page.locator('#table-target')).toHaveValue('150');await page.locator('#create-table').click();await page.locator('#ready').click();
  await expect(page.locator('body')).not.toHaveClass(/outside-game/);await expect(page.locator('#player-2 strong')).toContainText('Luis');await expect(page.locator('#team-us')).toContainText('Luis');
  await page.locator('#player-1 .mute-toggle').click();await expect(page.locator('#player-1 .mute-toggle')).toHaveAttribute('aria-pressed','true');
  await page.reload();await page.locator('#resume').click();await expect(page.locator('#player-1 .mute-toggle')).toHaveAttribute('aria-pressed','true');
  await page.locator('#game-home').click();await page.locator('#end-practice').click();await expect(page.locator('#resume')).toBeHidden();expect(errors).toEqual([]);
});
test('móvil horizontal táctil: mano real completa con la mesa grande y sin caras rivales',async({browser})=>{
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#home-practice').tap();await page.locator('#ready').tap();
  await expect(page.locator('body')).not.toHaveClass(/outside-game/);
  for(let i=0;i<120&&!(await page.locator('#result').isVisible());i++) {
    const tile=page.locator('.tile.playable:not(:disabled)').first();
    if(await tile.count()){await tile.tap();const end=page.locator('.end-marker:not([hidden])').first();await end.waitFor({state:'visible'});
      const box=await end.boundingBox();expect(box.x>=0&&box.y>=0&&box.x+box.width<=844&&box.y+box.height<=390).toBe(true);await end.tap();}
    await page.waitForTimeout(500);
  }
  await expect(page.locator('#result')).toBeVisible();
  const d=await page.evaluate(()=>patioDiagnostics());expect(d.opponentFaces).toBe(0);
  for(const seat of [1,2,3]){const b=await page.locator('#player-'+seat).boundingBox();expect(b.y>=0&&b.y+b.height<=390).toBe(true);}
  expect(errors).toEqual([]);await context.close();
});
