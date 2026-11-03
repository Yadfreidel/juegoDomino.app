import {test,expect} from '@playwright/test';
const settings={name:'Patio de los panas',target:200,turnSeconds:0,difficulty:'intermediate',environment:'courtyard',bonus:25,quickMessages:true};
// Routed snapshot: the authority decides; the page only animates what the snapshot says.
async function table(page,{style,mobile=false}={}) {
  if(style)await page.addInitScript(s=>localStorage.setItem('patio-preferences',JSON.stringify({launchStyle:s})),style);
  const plays=[];
  const s={revision:10,sessionId:'f',accepted:true,configured:true,settings,handNumber:1,turn:0,error:null,hand:[{a:2,b:5},{a:4,b:4},{a:0,b:1}],counts:[3,7,7,7],chain:[{left:2,right:2},{left:2,right:6}],
    moves:[{a:2,b:5,end:'left'}],scores:[0,0],wins:[0,0],events:[],result:null,deadline:null,serverNow:new Date().toISOString()};
  await page.route('**/api/game',r=>r.fulfill({json:s}));
  await page.route('**/api/play',async r=>{const cmd=r.request().postDataJSON();plays.push(cmd);await new Promise(x=>setTimeout(x,150));
    s.revision++;s.hand=s.hand.filter(t=>t.a!==cmd.a||t.b!==cmd.b);s.counts[0]--;s.turn=1;s.moves=[];s.chain=[{left:5,right:2},...s.chain];await r.fulfill({json:s});});
  await page.goto('/');await page.locator('#resume').click();await expect(page.locator('body')).not.toHaveClass(/outside-game/);
  await expect.poll(()=>page.evaluate(()=>typeof window.patioDiagnostics)).toBe('function');
  return plays;
}

test('menú radial: cerrado por defecto, Escape, tocar fuera, elegir y recordar sin jugar ni mover la cámara',async({page})=>{
  const plays=await table(page),menu=page.locator('#launch-menu');
  await expect(menu).toBeHidden();await expect(page.locator('#launch-toggle')).toHaveAttribute('aria-label','Estilo de lanzamiento: Suave');
  // What the player controls: look angle, tilt, zoom and inspection. Position may still ease into its framing.
  const look=()=>page.evaluate(()=>{const {yaw,tilt,zoom,inspecting}=patioDiagnostics().camera;return {yaw,tilt,zoom,inspecting};});
  const camera=await look();
  await page.locator('#launch-toggle').click();await expect(menu).toBeVisible();await expect(page.locator('#launch-toggle')).toHaveAttribute('aria-expanded','true');
  const box=await menu.boundingBox();expect(box.width).toBeGreaterThanOrEqual(160);expect(box.width).toBeLessThanOrEqual(222);
  // Never over my rack.
  const hand=await page.locator('.hand-wrap').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(hand.y+1);
  await page.keyboard.press('Escape');await expect(menu).toBeHidden();
  // A tile is selected, then the menu is opened and closed by tapping right on the table: nothing is played.
  await page.locator('[data-tile="2:5"]').click();await page.locator('#launch-toggle').click();await expect(menu).toBeVisible();
  const marker=await page.locator('#world-left').boundingBox();await page.mouse.click(marker.x+marker.width/2,marker.y+marker.height/2);
  await expect(menu).toBeHidden();await page.waitForTimeout(400);expect(plays).toHaveLength(0);
  expect(await look()).toEqual(camera);
  await page.locator('#launch-toggle').click();await page.locator('#launch-menu [data-style="golpe"]').click();await expect(menu).toBeHidden();
  await expect(page.locator('#launch-toggle')).toHaveAttribute('aria-label','Estilo de lanzamiento: Golpe');expect(plays).toHaveLength(0);
  await page.reload();await page.locator('#resume').click();await expect(page.locator('#launch-toggle')).toHaveAttribute('aria-label','Estilo de lanzamiento: Golpe');
  await page.locator('#launch-toggle').click();await expect(page.locator('#launch-menu [data-style="golpe"]')).toHaveAttribute('aria-checked','true');
});

for(const style of ['suave','golpe','giro','deslizar']) {
  test(`lanzamiento ${style}: una sola jugada, animada tras la respuesta y asentada en su pose`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const plays=await table(page,{style});
    await page.locator('[data-tile="2:5"]').click();const marker=page.locator('#world-left');await expect(marker).toBeVisible();
    // Rapid repeated taps on the destination still send exactly one move.
    await marker.evaluate(b=>{b.click();b.click();b.click();});
    await expect.poll(()=>plays.length).toBe(1);await page.waitForTimeout(500);expect(plays).toHaveLength(1);
    await expect.poll(()=>page.evaluate(()=>patioDiagnostics().lastLaunch),{timeout:8000}).toBe(style);
    await expect.poll(()=>page.evaluate(()=>patioDiagnostics().settled),{timeout:5000}).toBe(true);
    await expect(page.locator('[data-tile="2:5"]')).toHaveCount(0);expect(errors).toEqual([]);
  });
}

test('volver a la pestaña reconstruye la vista desde el estado real',async({page})=>{
  const plays=await table(page,{style:'deslizar'});
  await page.locator('[data-tile="2:5"]').click();await page.locator('#world-left').click();await expect.poll(()=>plays.length).toBe(1);
  await expect.poll(()=>page.evaluate(()=>patioDiagnostics().lastLaunch)).toBe('deslizar');
  // Mid-flight, the tab comes back: every tile jumps to its real pose and the hand is usable again.
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  expect(await page.evaluate(()=>patioDiagnostics().settled)).toBe(true);
});

test('móvil horizontal pequeño: barra lateral de 44 px, nada fuera de pantalla ni solapado con la mano',async({browser})=>{
  const context=await browser.newContext({viewport:{width:800,height:360},isMobile:true,hasTouch:true});const page=await context.newPage();
  await table(page);
  const view={width:800,height:360},inside=b=>b.x>=0&&b.y>=0&&b.x+b.width<=view.width+.5&&b.y+b.height<=view.height+.5;
  for(const id of ['launch-toggle','chat-toggle','emoji-toggle','sound','camera-table','settings','fullscreen','game-home']){const b=await page.locator('#'+id).boundingBox();expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(inside(b)).toBe(true);}
  const rail=await page.locator('.side-rail').boundingBox(),hand=await page.locator('.hand-wrap').boundingBox();expect(rail.x).toBeGreaterThan(hand.x+hand.width);
  await page.locator('#launch-toggle').tap();const menu=await page.locator('#launch-menu').boundingBox();expect(inside(menu)).toBe(true);expect(menu.y+menu.height).toBeLessThanOrEqual(hand.y+1);
  await page.locator('#launch-close').tap();await expect(page.locator('#launch-menu')).toBeHidden();
  await page.locator('#emoji-toggle').tap();await page.locator('[data-reaction="👏"]').tap();await expect(page.locator('#player-0 .chat-bubble')).toHaveText('👏');await expect(page.locator('#emoji-reactions')).toBeHidden();
  await context.close();
});
