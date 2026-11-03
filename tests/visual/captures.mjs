// Visual review of the whole app in the seven reference viewports, with measured layout checks.
// Fixed snapshots (routed /api/game) give repeatable tables; secondary screens use the real local authority.
// Usage, with the app open on 5091: node tests/visual/captures.mjs
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(import.meta.dirname,'../../docs/capturas');fs.mkdirSync(output,{recursive:true});
const base=process.env.PATIO_TEST_URL||'http://127.0.0.1:5091';
const settings={name:'Patio de los panas',target:200,turnSeconds:30,difficulty:'intermediate',environment:'courtyard',bonus:25,quickMessages:true,partner:'ana',counting:'all'};
const seats=[{name:'tu',bot:false},{name:'carlos',bot:true},{name:'ana',bot:true},{name:'luis',bot:true}];
// 26 tiles, all seven doubles included, so every value 0-6 can be checked on screen.
const long=[[6,6],[6,5],[5,5],[5,4],[4,4],[4,3],[3,3],[3,2],[2,2],[2,1],[1,1],[1,0],[0,0],[0,6],[6,4],[4,2],[2,0],[0,5],[5,3],[3,1],[1,6],[6,3],[3,0],[0,4],[4,1],[1,5]].map(([left,right])=>({left,right}));
const fixtures={
  larga:{chain:long,hand:[{a:2,b:5},{a:2,b:6}],counts:[2,7,6,5],moves:[{a:2,b:5,end:'right'},{a:2,b:6,end:'left'}]},
  inicio:{chain:[{left:6,right:6}],hand:[{a:2,b:5},{a:1,b:6},{a:4,b:4},{a:0,b:1},{a:6,b:2},{a:3,b:5},{a:0,b:0}],counts:[7,6,7,7],moves:[{a:1,b:6,end:'left'},{a:1,b:6,end:'right'},{a:6,b:2,end:'left'},{a:6,b:2,end:'right'}]},
  resultado:{chain:long.slice(0,12),hand:[],counts:[0,3,2,4],moves:[],result:{winner:0,points:64,reason:'Dominó',isVoid:false,capicua:true,remaining:[0,14,9,16],finished:false},events:['Paso corrido +25']}
};
function snapshot(f){return {revision:10,sessionId:'fixture',accepted:true,configured:true,settings,seats,handNumber:3,rulesVersion:'patio-rd/1',turn:0,error:null,events:[],scores:[75,60],wins:[0,0],result:null,deadline:new Date(Date.now()+30000).toISOString(),serverNow:new Date().toISOString(),...f};}
const views=[[360,800],[390,844],[430,932],[800,360],[844,390],[932,430],[1440,900]].map(([width,height])=>({name:`${width}x${height}`,viewport:{width,height},mobile:width<1000}));
const browser=await chromium.launch({headless:true}),report=[];
async function open(view,fixture) {
  const context=await browser.newContext({viewport:view.viewport,isMobile:view.mobile,hasTouch:view.mobile,deviceScaleFactor:view.mobile?2:1});
  await context.addInitScript(()=>{try{localStorage.setItem('patio-preferences',JSON.stringify({quality:'medium',music:0}));}catch{}});
  const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  if(fixture){const s=snapshot(fixtures[fixture]);await page.route('**/api/game',r=>r.fulfill({json:{...s,serverNow:new Date().toISOString()}}));}
  await page.goto(base);await page.waitForTimeout(800);return {context,page,errors,writes};
}
const shot=(page,name)=>page.screenshot({path:path.join(output,'barrio-'+name+'.png')});
// Measured layout: nothing cut off, four labels, my seven tiles at a readable size, no rival faces.
async function audit(page) {
  return page.evaluate(()=>{
    const inside=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;};
    const q=s=>document.querySelector(s),tiles=[...document.querySelectorAll('#hand .tile')].map(t=>t.getBoundingClientRect());
    const labels=[0,1,2,3].map(i=>document.getElementById('player-'+i)).filter(el=>getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>0);
    const d=window.patioDiagnostics?.();
    return {horizontalScroll:document.documentElement.scrollWidth>innerWidth,scoreboard:inside(q('.scoreboard')),hand:inside(q('.hand-wrap')),turn:inside(q('#turn-pill')),labels:labels.length,labelsInside:labels.every(inside),
      handTiles:tiles.length,minTileWidth:Math.round(Math.min(...tiles.map(r=>r.width))),tilesInside:[...document.querySelectorAll('#hand .tile')].every(inside),opponentFaces:d?.opponentFaces,orientation:d?.orientation};
  });
}
try {
  for(const view of views) {
    const home=await open(view,null);await shot(home.page,`${view.name}-inicio`);
    report.push({view:view.name,screen:'inicio',horizontalScroll:await home.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),homeButtonsVisible:await home.page.evaluate(()=>['home-quick','home-create','home-join','home-practice'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0;})),errors:home.errors});await home.context.close();
    const start=await open(view,'inicio');await start.page.locator('#resume').click();await start.page.waitForTimeout(2600);
    await shot(start.page,`${view.name}-mano-inicial`);report.push({view:view.name,screen:'mano inicial',...await audit(start.page),errors:start.errors});await start.context.close();
    const {context,page,errors}=await open(view,'larga');await page.locator('#resume').click();await page.waitForTimeout(2600);
    await page.locator('[data-tile="2:5"]').click();await page.waitForTimeout(700);await shot(page,`${view.name}-cadena-seleccion`);
    await page.locator('#cancel').click();await page.locator('#launch-toggle').click();await page.waitForTimeout(400);await shot(page,`${view.name}-menu-lanzamiento`);
    const radial=await page.locator('#launch-menu').boundingBox(),hand=await page.locator('.hand-wrap').boundingBox();await page.keyboard.press('Escape');
    report.push({view:view.name,screen:'cadena larga',...await audit(page),radialSize:Math.round(radial.width),radialAboveHand:radial.y+radial.height<=hand.y+1,errors});await context.close();
  }
  // Inspection, and the orientation change keeping the same game (no new deal, no writes, same tiles).
  {
    const {context,page,errors,writes}=await open(views[1],'larga');await page.locator('#resume').click();await page.waitForTimeout(2600);
    await page.locator('#camera-table').click();await page.waitForTimeout(1500);await shot(page,'390x844-inspeccion');await page.locator('#camera-reset').click().catch(()=>{});await page.locator('#camera-table').click();
    const before=await page.evaluate(()=>({tiles:patioDiagnostics().pooledTiles,hand:document.querySelectorAll('#hand .tile').length,revision:document.body.dataset.revision}));
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(1800);await shot(page,'rotacion-844x390');
    const after=await page.evaluate(()=>({tiles:patioDiagnostics().pooledTiles,hand:document.querySelectorAll('#hand .tile').length,revision:document.body.dataset.revision,orientation:patioDiagnostics().orientation}));
    report.push({screen:'rotación',before,after,writes,errors});await context.close();
  }
  // Hand result with the real breakdown (pips, capicúa bonus, bonus earned during the hand).
  for(const view of [views[1],views[6]]){const {context,page,errors}=await open(view,'resultado');await page.locator('#resume').click();await page.waitForTimeout(2600);await shot(page,`${view.name}-resultado`);report.push({view:view.name,screen:'resultado',errors});await context.close();}
  // Secondary screens against the real local authority.
  for(const view of [views[1],views[6]]) {
    const {context,page,errors}=await open(view,null);
    await page.locator('#home-create').click();await page.waitForTimeout(300);await shot(page,`${view.name}-crear-mesa`);
    await page.locator('#table-partner').selectOption('luis');await page.locator('#create-table').click();await page.locator('#lobby-seats .seat-card').first().waitFor();await shot(page,`${view.name}-sala`);
    await page.locator('#leave-lobby').click();await page.locator('#home-join').click();await page.locator('#join-code').fill('abc');await page.locator('#validate-code').click();await shot(page,`${view.name}-unirme`);
    await page.goBack();await page.locator('#home-profile').click();await shot(page,`${view.name}-perfil`);
    await page.goBack();await page.locator('#home-settings').click();await page.waitForTimeout(300);await shot(page,`${view.name}-ajustes`);await page.locator('#close-settings').click();
    await page.locator('#home-help').click();await page.waitForTimeout(300);await shot(page,`${view.name}-reglas`);
    report.push({view:view.name,screen:'secundarias',errors});await context.close();
  }
  fs.writeFileSync(path.join(output,'barrio-capturas.json'),JSON.stringify({browser:browser.version(),report},null,2));
  console.log(JSON.stringify(report,null,1));
} finally {await browser.close();}
