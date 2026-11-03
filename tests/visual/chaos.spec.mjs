import {test,expect} from '@playwright/test';
for(const viewport of [{width:1440,height:900},{width:390,height:844}])test('Caos restaura escena '+viewport.width,async({page})=>{
 await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.waitForFunction(()=>document.body.dataset.revision!==undefined);
 await page.evaluate(async()=>{await fetch('/api/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'chaos',chaosVariant:'visual'})});await fetch('/api/start',{method:'POST'});});
 await page.reload();await page.locator('#resume').click();await expect(page.locator('#chaos-toggle')).toBeVisible();
 await page.locator('#chaos-toggle').click();await expect(page.locator('#chaos-menu')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#chaos-menu')).toBeHidden();
 // Inspect the render controller through its diagnostics hook, with no private hands exposed.
 await page.waitForFunction(()=>window.patioDiagnostics);expect(errors).toEqual([]);
 await page.waitForFunction(()=>document.body.dataset.turn==='0',null,{timeout:30000});
 await page.evaluate(async()=>{const s=await (await fetch('/api/game')).json();if(!s.chain.length){const m=s.moves[0];await fetch('/api/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...m,revision:s.revision})});}});
 await page.waitForFunction(async()=>{const s=await (await fetch('/api/game')).json();return s.turn===0&&s.chain.length>0;},null,{polling:450,timeout:30000});
 await expect(page.locator('body')).toHaveAttribute('data-turn','0');
 await page.locator('#chaos-toggle').click();
 await page.getByRole('button',{name:/Golpe de mesa/}).click();await page.locator('#chaos-menu').getByRole('button',{name:/Activar/}).click();
 await page.waitForFunction(()=>window.patioDiagnostics().chaosActive);

 await page.waitForFunction(()=>!window.patioDiagnostics().chaosActive);expect(errors).toEqual([]);
});

test('Todos los efectos restauran poses y recursos',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/vendor/three.module.js'),{ChaosEffects}=await import('/chaos-effects.js');
  const root=new THREE.Scene(),table=new THREE.Group(),props=new THREE.Group();table.add(props);root.add(table);
  const geo=new THREE.BoxGeometry(1,.2,.5),mat=new THREE.MeshBasicMaterial();
  table.add(new THREE.Mesh(geo,mat));const nodes=new Map();
  for(let i=0;i<8;i++){const n=new THREE.Mesh(geo,mat);n.position.set(i*.4,2.2,i%2);n.rotation.y=i*.2;nodes.set(i+':'+i,n);root.add(n);}
  const scene={scene:root,tileNodes:nodes,table:{group:table,props},time:0,finishMotion(){},qualityLevel:'low'};
  const effects=new ChaosEffects(scene),original=[...nodes.values()].map(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);
  const failures=[];let moved=0;
  for(const power of ['slam','hurricane','electric','break','fire','ice','blackhole','dragon','wave','meteor','trancazo','capicua']){
   effects.play({power,seed:19,a:0,b:0});scene.time+=1;effects.update();if(effects.group.visible)moved++;
   scene.time+=5;effects.update();const poses=[...nodes.values()].map(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);
   if(JSON.stringify(poses)!==JSON.stringify(original)||scene.chaosBusy)failures.push(power);
  }
  effects.play({power:'break',seed:1});scene.time+=.5;effects.update();effects.cancel();
  if(table.children.some(n=>n.userData.chaosCopy&&n.visible))failures.push('cleanup');
  effects.dispose();geo.dispose();mat.dispose();return {failures,moved};
 });expect(result.failures).toEqual([]);expect(result.moved).toBe(12);
});
