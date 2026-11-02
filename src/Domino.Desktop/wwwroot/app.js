import {pipPattern} from './chain-layout.js';
import {PlacementController,sameTile,legalEnds} from './placement-controller.js';
import {GameClient} from './game-client.js';
import {TableSound} from './sound.js';
import {Preferences} from './preferences.js';
import {bindPersonalSettings} from './personal-settings.js';
import {PatioNavigation} from './navigation.js';
import {seatNames,teamNames} from './table-roster.js';
import {TableChat} from './table-chat.js';

const $=id=>document.getElementById(id);
const sound=new TableSound();const tileButtons=new Map();
const preferences=new Preferences();
let scene,placement,client,state,navigation,scenePromise,sorted=false,lastRevision=-1,shownResult=-1,uiBusy=false;
const dialogs=['welcome','result','settings-dialog','help-dialog','leave-dialog'];
const confirmSetting=$('confirm-setting');
const applyPreferences=bindPersonalSettings(preferences,sound,()=>scene);
const chat=new TableChat(preferences);preferences.addEventListener('change',()=>chat.render());
function show(id){for(const name of dialogs)if(name!==id)$(name).close();if(!$(id).open)$(id).showModal();}
// Same reading as the 3D pieces: each pip is a cavity (light lower lip, dark painted hole) and the centre line is incised.
function tileSvg(a,b){let lips='',dots='';for(const [n,cy] of [[a,25],[b,75]])for(const [x,y] of pipPattern[n]){const px=28+x*13,py=cy+y*13;lips+=`<circle cx="${px}" cy="${py+.7}" r="5.3"/>`;dots+=`<circle cx="${px}" cy="${py}" r="4.6"/>`;}return `<svg viewBox="0 0 56 100" aria-hidden="true"><defs><radialGradient id="pip-hole" cx=".45" cy=".4" r=".62"><stop offset="0" stop-color="#050505"/><stop offset=".72" stop-color="#14110e"/><stop offset="1" stop-color="#4a3d2c"/></radialGradient></defs><path d="M7 51.1H49" stroke="#fffaf0" stroke-width="1" opacity=".8"/><path d="M7 50H49" stroke="#2c261d" stroke-width="1.4"/><g fill="#fffaf0" opacity=".75">${lips}</g><g fill="url(#pip-hole)">${dots}</g></svg>`;}
function message(text){$('message').textContent=text;}
function connectionError(text){message(text);$('connection-status').textContent=text;$('connection-status').hidden=false;}
function drawHand() {
  if(!state)return;const hand=[...state.hand];if(sorted)hand.sort((a,b)=>a.a+a.b-b.a-b.b||a.a-b.a);
  const keys=new Set(hand.map(t=>t.a+':'+t.b));for(const [key,b] of tileButtons)if(!keys.has(key)){b.remove();tileButtons.delete(key);}
  for(let i=0;i<hand.length;i++) {
    const t=hand[i],key=t.a+':'+t.b;let b=tileButtons.get(key);
    if(!b) {
      b=document.createElement('button');tileButtons.set(key,b);b.innerHTML=tileSvg(t.a,t.b);b.dataset.tile=key;
      b.onpointerdown=e=>placement.pointerDown(e,t);
      b.onclick=e=>{if(performance.now()<placement.suppressClickUntil)return;if(e.detail===0)placement.select(t);};
    }
    const playable=legalEnds(state,t).length>0;
    b.className='tile'+(playable?' playable':'')+(sameTile(t,placement?.selected)?' selected':'');
    b.setAttribute('aria-label',`Ficha ${t.a}–${t.b}${playable?', jugada disponible':''}`);b.setAttribute('aria-pressed',String(sameTile(t,placement?.selected)));
    b.disabled=!state.accepted||state.turn!==0||!!state.result||placement?.busy||uiBusy||scene?.isPlacing;
    if($('hand').children[i]!==b)$('hand').insertBefore(b,$('hand').children[i]??null);
  }
}
function drawPlacement() {
  if(!placement||!state)return;
  const {selected,pending,busy,chosen}=placement;
  $('placement-tools').hidden=!selected;$('confirmation').hidden=!pending;$('confirm').disabled=busy||!chosen;
  $('confirm-text').textContent=selected?`¿Colocar ${selected.a}–${selected.b} por la ${chosen==='left'?'izquierda':'derecha'}?`:'';
  for(const end of ['left','right']) {
    const enabled=legalEnds(state,selected).includes(end);$(end).disabled=!enabled||busy||scene.isPlacing;
    $('world-'+end).hidden=!enabled||scene.isPlacing||pending||uiBusy;$('world-'+end).classList.toggle('selected',chosen===end);
  }
  document.body.classList.toggle('dragging-tile',!!placement.drag?.moved);drawHand();positionOverlay();
}
// Screen space the table may use: below the scoreboard, above my hand, inside the safe area.
function frameInsets() {
  const css=getComputedStyle(document.documentElement),safe=name=>parseFloat(css.getPropertyValue(name))||0;
  const top=document.querySelector('.scoreboard').getBoundingClientRect().bottom+6,hand=document.querySelector('.hand-wrap').getBoundingClientRect().top;
  return {top:Math.max(0,top),bottom:Math.max(0,innerHeight-hand+4),left:8+safe('--safe-left'),right:8+safe('--safe-right')};
}
function markerHit(x,y) {
  for(const end of ['left','right']){const m=$('world-'+end);if(m.hidden||!m.classList.contains('offscreen'))continue;const r=m.getBoundingClientRect();if(Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2))<60)return end;}
  return null;
}
function positionOverlay() {
  if(!scene)return;
  for(const end of ['left','right']) {
    const marker=$('world-'+end),destination=scene.endPoints.find(e=>e.end===end);
    if(!destination){marker.style.visibility='hidden';continue;}
    // A legal end outside the seated view is pinned to the screen edge instead of moving the camera.
    const p=scene.project(destination.point),bottom=Math.max(140,$('hand').getBoundingClientRect().top-56);
    const x=Math.min(innerWidth-44,Math.max(44,p.x)),y=Math.min(bottom,Math.max(120,p.y)),pinned=!p.visible||x!==p.x||y!==p.y;
    marker.style.left=x+'px';marker.style.top=y+'px';marker.style.visibility='visible';marker.classList.toggle('offscreen',pinned);
    marker.dataset.direction=!pinned?'':Math.abs(p.x-x)>=Math.abs(p.y-y)?(p.x<x?'←':'→'):(p.y<y?'↑':'↓');
  }
  // Compact labels sit on the frame next to each player's support; they never cover the felt centre.
  for(const {seat,point} of scene.playerAnchors()) {
    const p=scene.project(point),name=$('player-'+seat),halfW=name.offsetWidth/2,halfH=name.offsetHeight/2;
    name.style.left=Math.max(halfW+6,Math.min(innerWidth-halfW-6,p.x))+'px';name.style.top=Math.max(halfH+4,Math.min(innerHeight-halfH-4,p.y))+'px';name.style.right='auto';name.style.transform='translate(-50%,-50%)';
  }
  $('camera-table').setAttribute('aria-pressed',String(scene.view.inspecting));
}
function apply(next) {
  $('connection-status').hidden=true;
  if(state&&(next.revision<state.revision||(state.accepted&&!next.accepted&&next.revision===state.revision)))return;
  const changed=next.revision!==lastRevision;
  if(changed&&lastRevision>=0&&next.chain.length>(state?.chain.length??0)){sound.play();if(state?.turn===0&&preferences.value.vibration)navigator.vibrate?.(18);}
  state=next;document.body.dataset.revision=state.revision;document.body.dataset.turn=state.turn;
  $('score-us').textContent=state.scores[0];$('score-them').textContent=state.scores[1];$('hand-number').textContent='MANO '+String(state.handNumber).padStart(2,'0');
  const names=seatNames(state),teams=teamNames(state);$('team-us').textContent=teams.us;$('team-them').textContent=teams.them;
  for(let i=1;i<4;i++){const p=$('player-'+i);p.classList.toggle('active',state.accepted&&state.turn===i&&!state.result);p.querySelector('strong').innerHTML=i===2?'<span></span> <em>tu frente</em>':'<span></span>';p.querySelector('strong span').textContent=names[i];p.querySelector('small').textContent=state.counts[i]+' ficha'+(state.counts[i]===1?'':'s');}
  $('turn-indicator').classList.toggle('yours',state.accepted&&state.turn===0&&!state.result);
  $('turn-label').textContent=state.result?'Mano terminada':!state.accepted?'La mesa está lista':state.turn===0?'Tu turno':'Juega '+names[state.turn];
  const seconds=state.deadline?Math.max(0,Math.ceil((Date.parse(state.deadline)-Date.parse(state.serverNow))/1000)):null;
  $('turn-hint').textContent=`${names[0]} · ${state.counts[0]} ficha${state.counts[0]===1?'':'s'} · ${seconds===null?'sin límite':seconds+' s'}`;
  const target=document.querySelector('.scoreboard .target');if(state.settings)target.textContent='A '+state.settings.target+' PUNTOS';
  $('location-name').textContent=state.settings?.environment==='terrace'?'LA TERRAZA':'EL PATIO';
  $('quick-reactions').hidden=!state.settings?.quickMessages||!state.accepted||!!state.result;chat.update(state);
  if(changed){scene?.update(state);if(state.events.length)message(state.events.map(e=>e.replace(/Asiento (\d)/g,(_,s)=>names[Number(s)])).at(-1));}
  placement?.sync();navigation?.update(state);if(state.result&&navigation?.route==='game'&&shownResult!==state.revision){shownResult=state.revision;renderResult();}
  lastRevision=state.revision;if(state.error)message(state.error);
}
function renderResult() {
  const r=state.result,ours=r.winner%2===0,names=seatNames(state),teams=teamNames(state);
  $('result-eyebrow').textContent=r.finished?'PARTIDA TERMINADA':'MANO '+state.handNumber+' · TERMINADA';
  $('result-title').textContent=r.isVoid?'Tranque empatado':r.capicua?'¡Capicúa!':r.reason==='Trancao'?'¡Trancao!':ours?'¡Buena esa, frente!':'Esta fue de ellos.';
  $('result-description').textContent=r.isVoid?`${names[r.winner]} trancó con las mismas pintas que su rival. Según las reglas de esta mesa, la mano es nula y nadie suma.`:
    `${names[r.winner]} ${r.reason==='Trancao'?'gana el tranque':'cerró la mano'}. ${ours?'La cuenta es para nosotros.':teams.them+' se llevan la cuenta.'}${state.settings.counting==='opponents'?' Solo cuentan las pintas de la pareja perdedora.':''}`;
  $('breakdown').replaceChildren(...r.remaining.map((n,i)=>{const div=document.createElement('div');div.textContent=names[i];const b=document.createElement('b');b.textContent=n;div.append(b);return div;}));
  $('result-points').textContent='+'+r.points;$('result-score').textContent=`Nosotros ${state.scores[0]} · Ellos ${state.scores[1]}${r.capicua?' · Incluye '+state.settings.bonus+' de capicúa':''}`;
  $('next').innerHTML=(r.finished?'Jugar la revancha':'Siguiente mano')+' <span>→</span>';show('result');
}
async function uiAction(path,body={}) {
  if(uiBusy)return;uiBusy=true;drawHand();try{return await client.action(path,body);}catch(e){message(e.message);}finally{uiBusy=false;drawPlacement();}
}
$('settings').onclick=()=>show('settings-dialog');$('close-settings').onclick=()=>$('settings-dialog').close();$('help').onclick=()=>show('help-dialog');$('close-help').onclick=()=>$('help-dialog').close();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('Tu navegador no permite pantalla completa en este momento.');}};
$('sort').onclick=()=>{if(placement?.drag?.moved)return;sorted=!sorted;drawHand();$('sort').setAttribute('aria-pressed',String(sorted));message(sorted?'Mano ordenada por pintas.':'Orden de reparto restaurado.');};
$('cancel').onclick=()=>placement.cancel();$('confirm-cancel').onclick=()=>placement.cancel();$('confirm').onclick=()=>placement.place(placement.chosen,true);
for(const end of ['left','right']){const place=()=>placement.place(end);$(end).onclick=place;$('world-'+end).onclick=place;}
$('start').onclick=async()=>{await uiAction('start');if(state.accepted){$('welcome').close();drawHand();message('¡Vamos arriba! Toca una ficha y luego su previsualización.');}};
$('next').onclick=async()=>{await uiAction('next');if(!state.result){$('result').close();placement.cancel();}};
$('camera-reset').onclick=()=>scene.view.reset();$('camera-table').onclick=()=>scene.view.setInspecting(!scene.view.inspecting);$('camera-in').onclick=()=>scene.view.dolly(-120);$('camera-out').onclick=()=>scene.view.dolly(120);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&placement?.selected)placement.cancel();});
window.addEventListener('pagehide',e=>{if(!e.persisted){client?.stop();placement?.dispose();scene?.view.unbind?.();scene?.dispose();sound.dispose();}});
async function ensureScene() {
  if(scenePromise)return scenePromise;
  scenePromise=(async()=>{
  const {PatioScene}=await import('./scene.js');scene=new PatioScene($('scene'));scene.view.getInsets=frameInsets;scene.markerHit=markerHit;scene.onFrame=positionOverlay;scene.onSettled=()=>placement?.sync();
  placement=new PlacementController({scene,getState:()=>state,onChange:()=>{drawPlacement();if(placement.selected)message(legalEnds(state,placement.selected).length?'Toca el extremo iluminado o arrastra tu ficha hasta él.':'Esta ficha no coincide con las puntas.');},onSubmit:async command=>{try{await client.action('play',command);}catch(e){message(e.message);}},onSound:kind=>sound.play(kind),needsConfirmation:()=>confirmSetting.checked});
  scene.view.bindControls({onTap:(x,y)=>{const end=scene.hitDestination(x,y);if(end)placement.place(end);}});
  applyPreferences();if(state){scene.update(state);placement.sync();}
  window.patioDiagnostics=(reset=false)=>{const metrics=scene.metrics();if(reset)scene.performanceSamples.length=0;return metrics;};return scene;
  })();
  return scenePromise;
}
client=new GameClient(apply,error=>connectionError(error.message));
navigation=new PatioNavigation({getState:()=>state,action:(path,body)=>client.action(path,body),enterGame:async()=>{try{await ensureScene();sound.unlock();}catch(e){$('fatal').hidden=false;$('fatal-message').textContent='No se pudo iniciar WebGL 2: '+e.message;throw e;}},showDialog:show,onEnvironment:name=>{if(scene)scene.setEnvironment(name);},onError:connectionError});
navigation.onEnter=()=>{scene.setEnvironment(state.settings.environment);apply(state);if(state?.result)renderResult();};
try{await client.request('game');}catch(e){connectionError(e.message);}client.poll();
const warmup=()=>ensureScene().catch(e=>console.warn('La vista previa 3D no se pudo cargar.',e));
if('requestIdleCallback' in window)requestIdleCallback(warmup,{timeout:1500});else setTimeout(warmup,800);
