import {LAUNCH_STYLES,launchStyle} from './launch-styles.js';

const $=id=>document.getElementById(id);
const ANIMATION_MS=180,RADIAL={min:160,max:220};

// Side rail of the table: launch-style radial menu, quick messages, reactions, plus the landscape prompt.
// Pure presentation: choosing a style only changes a local preference, never sends or places anything.
export class TableControls {
  constructor({preferences,onMessage=()=>{}}) {
    this.preferences=preferences;this.onMessage=onMessage;this.open=null;
    this.panels={launch:$('launch-menu'),chat:$('quick-reactions'),emoji:$('emoji-reactions')};
    this.toggles={launch:$('launch-toggle'),chat:$('chat-toggle'),emoji:$('emoji-toggle')};
    for(const [name,button] of Object.entries(this.toggles))button.onclick=()=>this.toggle(name);
    $('launch-close').onclick=()=>this.close();
    // The backdrop swallows the closing tap so it can never select a tile, place one or move the camera.
    $('menu-backdrop').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.close();});
    for(const button of this.panels.launch.querySelectorAll('[data-style]'))button.onclick=()=>{preferences.set({launchStyle:button.dataset.style});this.close();};
    for(const button of document.querySelectorAll('.rail-panel [data-reaction]'))button.addEventListener('click',()=>this.close());
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.open){e.stopPropagation();this.close();}},true);
    window.addEventListener('resize',()=>{this.place();this.refreshPrompt();});
    $('rotate-go').onclick=()=>this.goLandscape();$('rotate-dismiss').onclick=()=>{try{sessionStorage.setItem('patio-rotate-dismissed','1');}catch{}this.refreshPrompt();};
    preferences.addEventListener('change',()=>this.render());this.render();
    // Leaving the table closes any open panel and the landscape prompt.
    new MutationObserver(()=>{if(document.body.classList.contains('outside-game'))this.close(true);this.refreshPrompt();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  }
  // Messages and reactions only exist when the table allows quick messages and a hand is being played.
  setTalkAvailable(on){for(const name of ['chat','emoji']){this.toggles[name].hidden=!on;if(!on&&this.open===name)this.close(true);}}
  render() {
    const style=launchStyle(this.preferences.value.launchStyle),menu=this.panels.launch;
    for(const button of menu.querySelectorAll('[data-style]')){const on=button.dataset.style===style;button.setAttribute('aria-checked',String(on));if(on)menu.style.setProperty('--slot',button.dataset.slot);}
    this.toggles.launch.setAttribute('aria-label','Estilo de lanzamiento: '+LAUNCH_STYLES[style].label);this.toggles.launch.dataset.current=style;
  }
  toggle(name){if(this.open===name)this.close();else this.show(name);}
  show(name) {
    if(this.open)this.close(true);
    const panel=this.panels[name];this.open=name;panel.hidden=false;$('menu-backdrop').hidden=false;this.toggles[name].setAttribute('aria-expanded','true');
    this.place();requestAnimationFrame(()=>panel.classList.add('open'));
    (panel.querySelector('[aria-checked=true]')??panel.querySelector('button'))?.focus({preventScroll:true});
  }
  close(immediate=false) {
    if(!this.open)return;
    const name=this.open,panel=this.panels[name];this.open=null;panel.classList.remove('open');$('menu-backdrop').hidden=true;this.toggles[name].setAttribute('aria-expanded','false');
    const hide=()=>{if(!panel.classList.contains('open'))panel.hidden=true;};if(immediate)hide();else setTimeout(hide,ANIMATION_MS);
  }
  // Beside the rail, centred on its button, kept between the top bar and my rack. If a comfortable circle
  // does not fit, the same four options become a compact 2×2 panel.
  place() {
    if(!this.open)return;
    const panel=this.panels[this.open],toggle=this.toggles[this.open].getBoundingClientRect(),rail=document.querySelector('.side-rail').getBoundingClientRect();
    const top=document.querySelector('.hud-top').getBoundingClientRect().bottom+6,bottom=document.querySelector('.hand-wrap').getBoundingClientRect().top-6;
    let size=0;
    if(this.open==='launch'){const room=Math.min(bottom-top,rail.left-16);size=Math.max(RADIAL.min,Math.min(RADIAL.max,room));panel.classList.toggle('compact',room<RADIAL.min);if(room>=RADIAL.min)panel.style.setProperty('--size',size+'px');}
    const box=panel.getBoundingClientRect(),height=box.height||size;
    const y=Math.min(Math.max(top,toggle.top+toggle.height/2-height/2),Math.max(top,bottom-height));
    panel.style.top=y+'px';panel.style.right=(innerWidth-rail.left+10)+'px';
  }
  // Fullscreen and landscape need a user gesture; where the browser refuses, the portrait layout stays playable.
  refreshPrompt() {
    let dismissed=false;try{dismissed=sessionStorage.getItem('patio-rotate-dismissed')==='1';}catch{}
    const show=!document.body.classList.contains('outside-game')&&innerHeight>innerWidth&&matchMedia('(pointer:coarse)').matches&&!dismissed;
    $('rotate-prompt').hidden=!show;
  }
  async goLandscape() {
    try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.({navigationUI:'hide'});}catch{}
    try{if(!screen.orientation?.lock)throw new Error('sin bloqueo');await screen.orientation.lock('landscape');}catch{this.onMessage('Este navegador no permite girar la pantalla solo: gira el teléfono. La partida sigue en vertical mientras tanto.');}
    this.refreshPrompt();
  }
}
