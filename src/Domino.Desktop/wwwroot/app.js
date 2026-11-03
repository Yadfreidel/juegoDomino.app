import {ChaosMenu} from './chaos-menu.js';
import {pipPattern} from './chain-layout.js';
import {PlacementController,sameTile,legalEnds} from './placement-controller.js';
import {GameClient} from './game-client.js';
import {TableSound} from './sound.js';
import {Preferences} from './preferences.js';
import {bindPersonalSettings} from './personal-settings.js';
import {PatioNavigation} from './navigation.js';
import {seatNames,teamNames} from './table-roster.js';
import {TableChat} from './table-chat.js';
import {TableControls} from './table-controls.js';
import {LAUNCH_STYLES} from './launch-styles.js';

const $=id=>document.getElementById(id);
const sound=new TableSound();const tileButtons=new Map();
const preferences=new Preferences();
let scene,placement,client,state,navigation,scenePromise,sorted=false,lastRevision=-1,shownResult=-1,uiBusy=false,deadline=null;
const dialogs=['welcome','result','settings-dialog','help-dialog','leave-dialog'];
const confirmSetting=$('confirm-setting');
$('chaos-camera').checked=localStorage.getItem('patio-chaos-camera')!=='false';$('chaos-camera').onchange=()=>{localStorage.setItem('patio-chaos-camera',String($('chaos-camera').checked));if(scene)scene.chaosCameraMotion=$('chaos-camera').checked;};
const applyPreferences=bindPersonalSettings(preferences,sound,()=>scene);
const chat=new TableChat(preferences);preferences.addEventListener('change',()=>chat.render());
let lastChaosEvent=null,chaosTimer=null;
const chaosMenu=new ChaosMenu({getState:()=>state,activate:c=>client.action('power',c),onError:message});
window.addEventListener('chaos-cancel',()=>{clearTimeout(chaosTimer);if(scene){scene.chaos.frozen=false;scene.chaos.cancel();}});
const controls=new TableControls({preferences,onMessage:text=>message(text)});
function show(id){for(const name of dialogs)if(name!==id)$(name).close();if(!$(id).open)$(id).showModal();}
// Same reading as the 3D pieces: each pip is a cavity (light lower lip, dark painted hole) and the centre line is incised.
function tileSvg(a,b){let lips='',dots='';for(const [n,cy] of [[a,25],[b,75]])for(const [x,y] of pipPattern[n]){const px=28+x*13,py=cy+y*13;lips+=`<circle cx="${px}" cy="${py+.7}" r="5.3"/>`;dots+=`<circle cx="${px}" cy="${py}" r="4.6"/>`;}return `<svg viewBox="0 0 56 100" aria-hidden="true"><defs><radialGradient id="pip-hole" cx=".45" cy=".4" r=".62"><stop offset="0" stop-color="#050505"/><stop offset=".72" stop-color="#14110e"/><stop offset="1" stop-color="#4a3d2c"/></radialGradient></defs><path d="M7 51.1H49" stroke="#fffaf0" stroke-width="1" opacity=".8"/><path d="M7 50H49" stroke="#2c261d" stroke-width="1.4"/><g fill="#fffaf0" opacity=".75">${lips}</g><g fill="url(#pip-hole)">${dots}</g></svg>`;}
function message(text){$('message').textContent=text;}
// Updates only two text nodes per second: the 3D scene is never touched by the clock.
function tickTimer() {
  const timer=$('turn-timer');if(!deadline){timer.hidden=true;return;}
  const seconds=Math.max(0,Math.ceil((deadline.at-(Date.now()+deadline.offset))/1000));
  timer.hidden=false;$('timer-value').textContent=seconds+' s';timer.classList.toggle('low',seconds<=5);timer.setAttribute('aria-label',seconds+' segundos para jugar');
}
setInterval(tickTimer,250);
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
    b.disabled=!state.accepted||state.turn!==0||!!state.result||placement?.busy||uiBusy||scene?.isPlacing||scene?.chaosBusy;
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
  const rect=selector=>document.querySelector(selector).getBoundingClientRect(),portrait=innerHeight>innerWidth;
  const top=Math.max(rect('.scoreboard').bottom,rect('.hud-tools').bottom)+6;
  const bottom=Math.min(rect('.hand-wrap').top,portrait?rect('.turn-status').top:Infinity)-4;
  return {top:Math.max(0,top),bottom:Math.max(0,innerHeight-bottom),left:8+safe('--safe-left'),right:Math.max(8,innerWidth-rect('.side-rail').left+6)};
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
  const previousState=state;
  const changed=next.revision!==lastRevision;
  // With the table open, the sound comes from the scene when the tile lands (onLaunch).
  if(changed&&lastRevision>=0&&next.chain.length>(state?.chain.length??0)&&!scene)sound.play();
  state=next;document.body.dataset.revision=state.revision;document.body.dataset.turn=state.turn;
  $('score-us').textContent=state.scores[0];$('score-them').textContent=state.scores[1];$('hand-number').textContent='MANO '+String(state.handNumber).padStart(2,'0');
  const names=seatNames(state),teams=teamNames(state);$('team-us').textContent=teams.us;$('team-them').textContent=teams.them;
  // Exactly four labels: me, my partner opposite, a rival on each side. The active one gets an icon and text.
  for(let i=0;i<4;i++) {
    const p=$('player-'+i),active=state.accepted&&state.turn===i&&!state.result;p.classList.toggle('active',active);
    p.querySelector('strong').innerHTML=i===2?'<span></span> <em>tu frente</em>':'<span></span>';p.querySelector('strong span').textContent=i===0?'Tú':names[i];
    p.querySelector('small').textContent=state.counts[i]+' ficha'+(state.counts[i]===1?'':'s')+(state.chaos?.shields[i]?' ? Escudo':'');p.querySelector('.turn-text').textContent=active?', le toca jugar':'';
  }
  const mine=state.accepted&&state.turn===0&&!state.result;$('turn-pill').classList.toggle('mine',mine);
  $('turn-label').textContent=state.result?'Mano terminada':!state.accepted?'La mesa está lista':mine?'Tu turno':'Juega '+names[state.turn];
  // The countdown comes from the authority's deadline, corrected by its clock; never a fixed label.
  deadline=state.deadline&&!state.result?{at:Date.parse(state.deadline),offset:Date.parse(state.serverNow)-Date.now()}:null;tickTimer();
  const target=document.querySelector('.scoreboard .target');if(state.settings){target.textContent='A '+state.settings.target+' PUNTOS';$('table-title').textContent=state.settings.name;}
  controls.setTalkAvailable(!!state.settings?.quickMessages&&state.accepted&&!state.result);chat.update(state);
  if(changed){scene?.update(state);if(state.events.length)message(state.events.map(e=>e.replace(/Asiento (\d)/g,(_,s)=>names[Number(s)])).at(-1));}
  chaosMenu.update();
  const ev=state.chaos?.powerEvent;
  if(ev&&ev.id!==lastChaosEvent){lastChaosEvent=ev.id;if(Date.now()-Date.parse(ev.start)<4500&&state.settings.mode==='chaos'){
    if(['slam','hurricane','electric','fire','ice','blackhole','dragon','wave','meteor','break'].includes(ev.power))startChaos(ev);
    if(ev.power==='look'&&state.chaos.reveal){const r=state.chaos.reveal;message('La mirada: '+r.a+'–'+r.b);setTimeout(()=>{if($('message').textContent.startsWith('La mirada:'))message('La mirada terminó.');},3000);}
  }}
  if(changed&&state.settings.mode==='chaos'&&state.chain.length>(previousState?.chain.length??0)){
    if(state.result?.capicua)startChaos({power:'capicua',seed:state.revision});
    else if(state.result?.reason==='Trancao')startChaos({power:'trancazo',seed:state.revision});
    else if(scene?.chaos.frozen)startChaos({power:'shatter',seed:state.revision});
    else if(state.chain.some(t=>t.left===t.right&&!previousState?.chain.some(p=>p.left===t.left&&p.right===t.right)))startChaos({power:'electric',seed:state.revision});
  }
  placement?.sync();navigation?.update(state);if(state.result&&navigation?.route==='game'&&shownResult!==state.revision){shownResult=state.revision;if(state.settings.mode==='chaos'&&(state.result.capicua||state.result.reason==='Trancao')){const rev=state.revision;setTimeout(()=>{if(state.revision===rev&&navigation.route==='game')renderResult();},3500);}else renderResult();}
  lastRevision=state.revision;if(state.error)message(state.error);
}
function renderResult() {
  const r=state.result,ours=r.winner%2===0,names=seatNames(state),teams=teamNames(state);
  $('result-eyebrow').textContent=r.finished?'PARTIDA TERMINADA':'MANO '+state.handNumber+' · TERMINADA';
  $('result-title').textContent=r.isVoid?'Tranque empatado':r.capicua?'¡Capicúa!':r.reason==='Trancao'?'¡Trancao!':ours?'¡Buena esa, frente!':'Esta fue de ellos.';
  $('result-description').textContent=r.isVoid?`${names[r.winner]} trancó con las mismas pintas que su rival. Según las reglas de esta mesa, la mano es nula y nadie suma.`:
    `${r.winner===0?(r.reason==='Trancao'?'Ganaste el tranque':'Cerraste la mano'):names[r.winner]+(r.reason==='Trancao'?' gana el tranque':' cerró la mano')}. ${ours?'La cuenta es para nosotros.':teams.them+' se llevan la cuenta.'}${state.settings.counting==='opponents'?' Solo cuentan las pintas de la pareja perdedora.':''}`;
  $('breakdown').replaceChildren(...r.remaining.map((n,i)=>{const div=document.createElement('div');div.textContent=names[i];const b=document.createElement('b');b.textContent=n;div.append(b);return div;}));
  const bonus=r.capicua?state.settings.bonus:0,counted=r.points-bonus,lines=[];
  if(!r.isVoid)lines.push([state.settings.counting==='opponents'?'Pintas de la pareja perdedora':'Pintas de las cuatro manos',counted]);
  if(bonus)lines.push(['Bono de capicúa',bonus]);
  const handBonuses=state.events.filter(e=>/\+\d+$|bono descartado/.test(e)).map(e=>e.replace(/Asiento (\d)/g,(_,n)=>names[Number(n)]));
  $('result-lines').replaceChildren(...lines.map(([label,value])=>{const li=document.createElement('li');li.textContent=label;const b=document.createElement('b');b.textContent='+'+value;li.append(b);return li;}),
    ...handBonuses.map(text=>{const li=document.createElement('li');li.textContent=text.includes('descartado')?text:text+' · sumado durante la mano';return li;}));
  $('result-points').textContent='+'+r.points;$('result-score').textContent=`Nosotros ${state.scores[0]} · Ellos ${state.scores[1]} · Meta ${state.settings.target}`;
  $('result').classList.toggle('celebrate',!r.isVoid&&(r.capicua||r.reason!=='Trancao'));
  $('next').innerHTML=(r.finished?'Jugar la revancha':'Siguiente mano')+' <span>→</span>';show('result');
}
function startChaos(event){
  clearTimeout(chaosTimer);if(!scene)return;
  chaosTimer=setTimeout(()=>{if(document.body.classList.contains('outside-game'))return;scene.chaos.play(event);sound.play(event.power==='electric'?'electric':event.power==='capicua'?'celebrate':'slam');if(preferences.value.vibration)navigator.vibrate?.(18);drawPlacement();},scene.isPlacing?950:0);
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
$('camera-reset').onclick=()=>scene.view.reset();$('camera-table').onclick=()=>scene.view.setInspecting(!scene.view.inspecting);
// Coming back to the tab: show the real state at once, never a half-finished flight.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&scene){scene.chaos.cancel();scene.finishMotion();placement?.sync();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&placement?.selected)placement.cancel();});
window.addEventListener('pagehide',e=>{if(!e.persisted){client?.stop();placement?.dispose();scene?.view.unbind?.();scene?.dispose();sound.dispose();}});
async function ensureScene() {
  if(scenePromise)return scenePromise;
  scenePromise=(async()=>{
  const {PatioScene}=await import('./scene.js');scene=new PatioScene($('scene'));scene.chaosCameraMotion=$('chaos-camera').checked;scene.view.getInsets=frameInsets;scene.markerHit=markerHit;scene.onFrame=positionOverlay;scene.onSettled=()=>placement?.sync();scene.onLayout=()=>placement?.sync();
  // Landing feedback timed with the animation: style sound, and a short vibration for my own moves if enabled.
  scene.onLaunch=({style,seat})=>{const s=LAUNCH_STYLES[style];setTimeout(()=>{sound.play(s.sound);if(seat===0&&preferences.value.vibration)navigator.vibrate?.(s.vibrate||12);},scene.reducedMotion?0:s.duration*880);};
  placement=new PlacementController({scene,getState:()=>state,onChange:()=>{drawPlacement();if(placement.selected)message(legalEnds(state,placement.selected).length?'Toca el extremo iluminado o arrastra tu ficha hasta él.':'Esta ficha no coincide con las puntas.');},onSubmit:async command=>{try{await client.action('play',command);}catch(e){message(e.message);}},onSound:kind=>sound.play(kind),needsConfirmation:()=>confirmSetting.checked});
  scene.view.bindControls({onTap:(x,y)=>{const end=scene.hitDestination(x,y);if(end)placement.place(end);}});
  applyPreferences();if(state){scene.update(state);placement.sync();}
  window.patioDiagnostics=(reset=false)=>{const metrics=scene.metrics();if(reset)scene.performanceSamples.length=0;return metrics;};return scene;
  })();
  return scenePromise;
}
client=new GameClient(apply,error=>connectionError(error.message));
navigation=new PatioNavigation({getState:()=>state,action:(path,body)=>client.action(path,body),enterGame:async()=>{const loading=$('scene-loading');loading.hidden=!!scene;try{await ensureScene();sound.unlock();}catch(e){$('fatal').hidden=false;$('fatal-message').textContent='Este dispositivo o navegador no pudo iniciar WebGL 2, que la mesa 3D necesita. Prueba con otro navegador, activa la aceleración gráfica o elige calidad baja en otro equipo. Detalle: '+e.message;throw e;}finally{loading.hidden=true;}},showDialog:show,onEnvironment:name=>{if(scene)scene.setEnvironment(name);},onError:connectionError});
navigation.onEnter=()=>{controls.refreshPrompt();scene.setEnvironment(state.settings.environment);apply(state);if(state?.result)renderResult();};
try{await client.request('game');}catch(e){connectionError(e.message);}client.poll();
const warmup=()=>ensureScene().catch(e=>console.warn('La vista previa 3D no se pudo cargar.',e));
if('requestIdleCallback' in window)requestIdleCallback(warmup,{timeout:1500});else setTimeout(warmup,800);
