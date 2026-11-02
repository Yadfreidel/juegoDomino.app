import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutChain,footprint,BOARD,previewTile,tilePose} from '../../src/Domino.Desktop/wwwroot/chain-layout.js';
import {legalEnds} from '../../src/Domino.Desktop/wwwroot/placement-controller.js';
import {TableCamera,LOOK_LIMITS,TILE_PIXELS_MIN} from '../../src/Domino.Desktop/wwwroot/camera-controller.js';
import {TABLE} from '../../src/Domino.Desktop/wwwroot/table-model.js';
import {newEvents} from '../../src/Domino.Desktop/wwwroot/table-chat.js';
import {rulesSummary,isDefaultRules,changedConditions,RULE_DEFAULTS} from '../../src/Domino.Desktop/wwwroot/table-roster.js';
import {PerspectiveCamera,Vector3} from '../../src/Domino.Desktop/wwwroot/vendor/three.module.js';

test('28 longitudes, dobles transversales, destinos reservados y límites',()=>{
  for(let count=0;count<=28;count++)for(let pattern=0;pattern<3;pattern++) {
    const chain=Array.from({length:count},(_,i)=>({left:i%7,right:pattern===0?i%7:pattern===1?(i+1)%7:i%3===0?i%7:(i+1)%7}));
    const result=layoutChain(chain);assert.deepEqual(layoutChain(chain),result);
    const placed=result.placements.map(footprint);
    for(const p of placed){assert.ok(Math.abs(p.x)+p.halfX<=BOARD.halfWidth+.01,`x ${count}`);assert.ok(Math.abs(p.z)+p.halfZ<=BOARD.halfDepth+.01,`z ${count}`);}
    for(let i=0;i<placed.length;i++)for(let j=0;j<i;j++){const a=placed[i],b=placed[j];assert.ok(Math.abs(a.x-b.x)>=a.halfX+b.halfX+.005||Math.abs(a.z-b.z)>=a.halfZ+b.halfZ+.005,`overlap ${count} ${i}/${j}`);}
    for(const end of ['left','right']){const ghost=footprint(tilePose(result.destinations[end],{left:3,right:3}));for(const p of placed)assert.ok(Math.abs(p.x-ghost.x)>=p.halfX+ghost.halfX+.005||Math.abs(p.z-ghost.z)>=p.halfZ+ghost.halfZ+.005,`ghost overlap ${count} ${end}`);}
  }
});
test('previsualiza orientación de las dos puntas sin decidir legalidad',()=>{
  const c=[{left:2,right:5}];assert.deepEqual(previewTile(c,{a:2,b:5},'left'),{left:5,right:2});assert.deepEqual(previewTile(c,{a:2,b:5},'right'),{left:5,right:2});
  const s={accepted:true,result:null,turn:0,chain:c,moves:[{a:2,b:5,end:'left'},{a:2,b:5,end:'right'}]};assert.deepEqual(legalEnds(s,{a:2,b:5}),['left','right']);assert.deepEqual(legalEnds({...s,turn:1},{a:2,b:5}),[]);assert.deepEqual(legalEnds(s,{a:0,b:0}),[]);
});
function viewFor(width,height,insets){
  const rect={left:0,top:0,width,height},canvas={getBoundingClientRect:()=>rect},camera=new PerspectiveCamera(36,1,.1,220);
  const view=new TableCamera(camera,canvas,{outline:TABLE.outline,playArea:TABLE.playArea,surfaceY:TABLE.feltTop,topY:TABLE.frameTop,felt:TABLE.feltHalf});
  view.getInsets=()=>insets;view.resize();view.update(1,true);return {view,camera,rect};
}
test('encuadre elevado: mesa ~90 % del ancho útil y paño entre marcador y mano',()=>{
  // Landscape phones with the compact HUD: scoreboard ~40 px, hand ~130 px.
  for(const [w,h,top,bottom] of [[844,390,40,128],[740,360,40,124],[932,430,40,132],[1440,900,135,230],[1280,720,120,215]]) {
    const {view}=viewFor(w,h,{top,bottom,left:8,right:8});
    const outline=TABLE.outline.map(([x,z])=>view.project(new Vector3(x,TABLE.frameTop,z)));
    const share=(Math.max(...outline.map(p=>p.x))-Math.min(...outline.map(p=>p.x)))/(w-16);
    assert.ok(share>=.85&&share<=.95,`ancho ${w}x${h}: ${share.toFixed(3)}`);
    for(const [x,z,y] of TABLE.playArea){const p=view.project(new Vector3(x,y,z));assert.ok(p.y>=top-2&&p.y<=h-bottom+2&&p.x>=0&&p.x<=w,`zona de juego visible ${w}x${h} (${x},${z}) → ${p.x.toFixed(0)},${p.y.toFixed(0)}`);}
    assert.ok(view.camera.position.z>0&&view.camera.position.y>TABLE.frameTop+3,'Siempre desde el lado del jugador y por encima');
  }
  const {view}=viewFor(390,844,{top:100,bottom:230,left:8,right:8});
  const xs=TABLE.outline.map(([x,z])=>view.project(new Vector3(x,TABLE.frameTop,z)).x);assert.ok(Math.max(...xs)-Math.min(...xs)>=.85*374,'Vertical: ancho completo');
});
test('mirar acotado, inspección legible y pantalla↔mesa con canvas desplazado',()=>{
  const {view,camera,rect}=viewFor(1440,900,{top:130,bottom:230,left:8,right:8});
  view.orbit(1e5,1e5);assert.equal(Math.abs(view.yaw),LOOK_LIMITS.yaw);assert.equal(Math.abs(view.tilt),LOOK_LIMITS.tilt);
  view.invertY=true;view.reset();view.orbit(0,50);assert.ok(view.tilt<0,'Eje vertical invertido');view.reset();view.update(1,true);
  const overview=camera.position.clone();
  view.setChainBounds({minX:-4.9,maxX:4.9,minZ:-2.6,maxZ:2.6});view.setInspecting(true);view.update(1,true);
  const a=view.project(new Vector3(0,2.168,0)),b=view.project(new Vector3(1.06,2.168,0));assert.ok(b.x-a.x>=TILE_PIXELS_MIN*.95,`ficha legible ${(b.x-a.x).toFixed(1)} px`);
  view.orbit(5000,5000);view.update(1,true);assert.ok(Math.abs(view.pan.x)<=TABLE.feltHalf.x&&Math.abs(view.pan.z)<=TABLE.feltHalf.z,'Inspección no sale del paño');
  view.reset();view.update(1,true);assert.ok(camera.position.distanceTo(overview)<1e-6,'Centrar mesa vuelve a la vista completa');
  rect.left=23;rect.top=17;view.resize();view.update(1,true);
  const point=new Vector3(2,2.168,.8),screen=view.project(point),back=view.tablePoint(screen.x,screen.y);assert.ok(point.distanceTo(back)<1e-6);
});
test('mensajes nuevos, resumen de reglas y cambios anunciados',()=>{
  assert.deepEqual(newEvents(['a','b','c'],['b','c','d','e']),['d','e']);assert.deepEqual(newEvents(['a'],['a']),[]);
  assert.ok(isDefaultRules({...RULE_DEFAULTS}));assert.ok(!isDefaultRules({...RULE_DEFAULTS,counting:'opponents'}));
  assert.match(rulesSummary({...RULE_DEFAULTS}),/sale quien gana la mano.*cuatro manos.*bonos de 25: capicúa, paso corrido, pase de salida/);
  assert.match(rulesSummary({...RULE_DEFAULTS,bonus:0}),/sin bonificaciones/);
  assert.deepEqual(changedConditions({target:200,blockTie:'blocker'},{target:150,blockTie:'void'}),['meta','empate de tranque']);
});
