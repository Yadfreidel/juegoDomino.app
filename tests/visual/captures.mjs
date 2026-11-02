// Visual review of the table and tiles: fixed snapshots (long chain with every double, short chain),
// selection preview, inspection, three viewports and the three quality levels.
// Usage, with the app open on 5091: node tests/visual/captures.mjs
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(import.meta.dirname,'../../docs/capturas');fs.mkdirSync(output,{recursive:true});
const base=process.env.PATIO_TEST_URL||'http://127.0.0.1:5091';
const settings={name:'Mesa de prueba',target:200,turnSeconds:0,difficulty:'intermediate',environment:'courtyard',bonus:25,quickMessages:true};
// 26 tiles, all seven doubles included, so every value 0-6 can be checked on screen.
const long=[[6,6],[6,5],[5,5],[5,4],[4,4],[4,3],[3,3],[3,2],[2,2],[2,1],[1,1],[1,0],[0,0],[0,6],[6,4],[4,2],[2,0],[0,5],[5,3],[3,1],[1,6],[6,3],[3,0],[0,4],[4,1],[1,5]].map(([left,right])=>({left,right}));
const fixtures={
  larga:{chain:long,hand:[{a:2,b:5},{a:2,b:6}],counts:[2,7,6,5],moves:[{a:2,b:5,end:'right'},{a:2,b:6,end:'left'}]},
  corta:{chain:[{left:6,right:6},{left:6,right:3},{left:3,right:1}],hand:[{a:2,b:5},{a:1,b:5},{a:4,b:4},{a:0,b:1},{a:1,b:2},{a:3,b:5},{a:0,b:0}],counts:[7,6,6,6],moves:[{a:1,b:5,end:'right'},{a:0,b:1,end:'right'},{a:1,b:2,end:'right'}]}
};
function state(f){return {revision:10,sessionId:'fixture',accepted:true,configured:true,settings,handNumber:1,turn:0,error:null,...f,scores:[35,40],wins:[0,0],events:[],result:null,deadline:null,serverNow:new Date().toISOString()};}
const views=[
  {name:'pc',viewport:{width:1440,height:900},mobile:false,quality:'high'},
  {name:'movil-h',viewport:{width:844,height:390},mobile:true,quality:'medium'},
  {name:'movil-v',viewport:{width:390,height:844},mobile:true,quality:'medium'}
];
const browser=await chromium.launch({headless:true}),report=[];
async function open(view,fixture,quality=view.quality) {
  const context=await browser.newContext({viewport:view.viewport,isMobile:view.mobile,hasTouch:view.mobile,deviceScaleFactor:view.mobile?2:1});
  await context.addInitScript(q=>{try{localStorage.setItem('patio-preferences',JSON.stringify({quality:q,music:0}));}catch{}},quality);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
  const s=state(fixtures[fixture]);await page.route('**/api/game',r=>r.fulfill({json:s}));
  await page.goto(base);await page.locator('#resume').click();await page.waitForFunction(()=>typeof patioDiagnostics==='function');
  await page.waitForTimeout(2500);return {context,page,errors};
}
const shot=(page,name)=>page.screenshot({path:path.join(output,name+'.png')});
try {
  for(const view of views) {
    const {context,page,errors}=await open(view,'larga');
    await shot(page,`realista-${view.name}-cadena-26`);
    await page.locator('[data-tile="2:5"]').click();await page.waitForTimeout(600);await shot(page,`realista-${view.name}-seleccion`);
    await page.locator('#cancel').click().catch(()=>{});
    await page.locator('#camera-table').click();await page.waitForTimeout(1500);await shot(page,`realista-${view.name}-inspeccion`);
    report.push({view:view.name,fixture:'larga',metrics:await page.evaluate(()=>patioDiagnostics()),errors});await context.close();
    const short=await open(view,'corta');await shot(short.page,`realista-${view.name}-partida`);
    report.push({view:view.name,fixture:'corta',metrics:await short.page.evaluate(()=>patioDiagnostics()),errors:short.errors});await short.context.close();
  }
  for(const quality of ['low','medium','high']) {
    const {context,page,errors}=await open(views[1],'larga',quality);await shot(page,`realista-calidad-${quality}`);
    report.push({view:'movil-h',quality,metrics:await page.evaluate(()=>patioDiagnostics()),errors});await context.close();
  }
  fs.writeFileSync(path.join(output,'realista-capturas.json'),JSON.stringify({browser:browser.version(),report},null,2));
  console.log(JSON.stringify(report.map(r=>({view:r.view,fixture:r.fixture,quality:r.metrics.quality,draws:r.metrics.drawCalls,tris:r.metrics.triangles,textures:r.metrics.textures,faces:r.metrics.opponentFaces,errors:r.errors})),null,1));
} finally {await browser.close();}
