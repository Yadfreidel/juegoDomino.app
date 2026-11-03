import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
 test('Catalogo visible de poderes '+viewport.width,async({page})=>{
  await page.setViewportSize(viewport);await page.route('**/app.js*',r=>r.abort());await page.goto('/');
  await page.evaluate(async()=>{
   document.body.classList.remove('outside-game');document.getElementById('screens').hidden=true;
   const {ChaosMenu}=await import('/chaos-menu.js?v=caos-panel-2');
   const state={accepted:true,revision:1,turn:0,result:null,settings:{mode:'chaos',chaosVariant:'rules'},chaos:{remaining:3,turnRemaining:1,shields:[false,false,false,false]},chain:[{left:6,right:6}],seats:[{name:'Tu'},{name:'Carlos'},{name:'Ana'},{name:'Luis'}]};
   window.testMenu=new ChaosMenu({getState:()=>state,activate:async c=>{window.powerCommand=c;},onError:message=>{throw new Error(message);}});window.testMenu.update();
  });
  const toggle=page.getByRole('button',{name:'Poderes Caos',exact:true});await expect(toggle).toBeVisible();await expect(toggle).toContainText('3');await toggle.click();
  const panel=page.locator('#chaos-menu');await expect(panel.locator('.chaos-power')).toHaveCount(15);
  await panel.getByRole('button',{name:/Reparto loco/}).click();await expect(panel.getByRole('button',{name:/Activar/})).toBeEnabled();
  const bounds=await panel.boundingBox(),hand=await page.locator('.hand-wrap').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(hand.y);
  await panel.getByRole('button',{name:/La mirada/}).click();await panel.getByLabel('Rival objetivo').selectOption('3');await panel.getByRole('button',{name:/Activar/}).click();
  expect(await page.evaluate(()=>window.powerCommand)).toMatchObject({power:'look',target:3,revision:1});await expect(panel).toBeHidden();
  await toggle.click();await panel.getByRole('button',{name:/radial/}).click();await expect(panel.locator('.chaos-power')).toHaveCount(4);await page.keyboard.press('Escape');await expect(panel).toBeHidden();
 });
}
