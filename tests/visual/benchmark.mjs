import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(import.meta.dirname,'../../docs/capturas');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try {
  for(const profile of [{name:'pc',width:1440,height:900,mobile:false},{name:'movil',width:390,height:844,mobile:true}].filter(p=>!process.env.PATIO_BENCH_PROFILE||p.name===process.env.PATIO_BENCH_PROFILE)) {
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:profile.mobile,hasTouch:profile.mobile,deviceScaleFactor:1});const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.PATIO_TEST_URL||'http://127.0.0.1:5091');await page.waitForFunction(()=>typeof patioDiagnostics==='function');
    if(!profile.mobile)await page.screenshot({path:path.join(output,'pc-inicio.png')});
    await page.locator('#home-practice').click();await page.locator('#ready').click();await page.waitForTimeout(4000);await page.evaluate(()=>patioDiagnostics(true));
    await page.waitForTimeout(10000);
    const data=await page.evaluate(async()=>{const gl=document.getElementById('scene').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info'),s=await(await fetch('/api/game')).json();return {...patioDiagnostics(),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),chainCount:s.chain.length};});
    results.push({profile:profile.name,headless:true,warmupSeconds:4,sampleSeconds:10,...data,errors});
    const playable=page.locator('.tile.playable:not(:disabled)').first();if(await playable.count())await playable.click();
    await page.screenshot({path:path.join(output,profile.name+'-partida-actual.png')});
    if(profile.mobile){await page.setViewportSize({width:844,height:390});await page.locator('#camera-reset').click();await page.waitForTimeout(1000);await page.screenshot({path:path.join(output,'movil-horizontal-actual.png')});}
    await context.close();
  }
  fs.writeFileSync(path.join(output,'rendimiento-local.json'),JSON.stringify({date:'2026-11-02',browser:browser.version(),results},null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
