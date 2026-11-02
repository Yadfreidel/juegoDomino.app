// Renders the home cover from the real table, tiles, materials and lighting (no external art), with a
// transparent background so it can be composed over the night-blue theme. Usage, with the app on 5091:
//   node tests/visual/render-cover.mjs <out.png>
import {chromium} from 'playwright';
const out=process.argv[2],base=process.env.PATIO_TEST_URL||'http://127.0.0.1:5091';
const html=`<!doctype html><html><body style="margin:0;background:transparent"><canvas id=c width=1200 height=900></canvas>
<script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>
<script type="module">
import * as THREE from '${base}/vendor/three.module.js';
import {TilePresenter} from '${base}/tile-presenter.js';
import {DominoTableModel,TABLE_LAYOUTS} from '${base}/table-model.js';
import {TableLighting} from '${base}/lighting.js';
import {SurfaceTextures,createTableMaterials} from '${base}/materials.js';
import {TILE} from '${base}/chain-layout.js';
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(1200,900,false);renderer.setClearColor(0,0);
const scene=new THREE.Scene(),light=new TableLighting(renderer,scene);light.setMood('club');light.applyQuality({shadows:true,shadowSize:2048,softShadows:true,reflections:true});
const tiles=new TilePresenter(),surfaces=new SurfaceTextures();surfaces.setAnisotropy(8);const materials=createTableMaterials(surfaces);
const table=new DominoTableModel(tiles,materials,TABLE_LAYOUTS.landscape);scene.add(table.group);table.setCounts([0,7,7,7]);
const {coated,...surf}=materials;light.reflect([...Object.values(surf),...tiles.materials.ivory,tiles.materials.ink,tiles.materials.back]);
// Two pieces near my rail, the second one resting across the first like the reference cover.
const a=tiles.face(6,6,scene);a.position.set(1.15,TILE.y,2.35);a.rotation.y=.42;
const b=tiles.face(5,4,scene);b.position.set(1.85,TILE.y+.1,2.05);b.rotation.set(.0,-.35,.11);
const cam=new THREE.PerspectiveCamera(30,1200/900,.3,100);cam.position.set(-2.6,6.2,11.2);cam.lookAt(1.2,2.2,2.6);
await new Promise(r=>setTimeout(r,2500));renderer.shadowMap.needsUpdate=true;renderer.render(scene,cam);window.done=true;
</script></body></html>`;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:900}});
page.on('pageerror',e=>console.log('error',e.message));
await page.route('**/__cover.html',r=>r.fulfill({contentType:'text/html',body:html}));
await page.goto(base+'/__cover.html');await page.waitForFunction(()=>window.done,null,{timeout:60000});
await page.locator('#c').screenshot({path:out,omitBackground:true});await browser.close();
