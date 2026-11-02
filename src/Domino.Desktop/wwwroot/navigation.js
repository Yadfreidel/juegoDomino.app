import {seatNames,rulesSummary,conditionsSummary,changedConditions,isDefaultRules,RULE_DEFAULTS} from './table-roster.js';

const $=id=>document.getElementById(id);
const fields={name:'table-name',target:'table-target',turnSeconds:'table-time',difficulty:'table-difficulty',environment:'table-environment',bonus:'table-bonus',quickMessages:'table-messages',
  partner:'table-partner',nextOpener:'rule-next',counting:'rule-counting',blockRule:'rule-block',blockTie:'rule-tie',capicua:'rule-capicua',pasoCorrido:'rule-run',paseSalida:'rule-opening'};
const numeric=new Set(['target','turnSeconds','bonus']);
const defaults={name:'La mesa de los panas',target:200,turnSeconds:0,difficulty:'intermediate',environment:'club',quickMessages:true,partner:'ana',...RULE_DEFAULTS};
const practiceDefaults={...defaults,name:'Práctica en el patio'};
const routes=['home','choice','config','lobby','game','profile','join'];

export class PatioNavigation {
  constructor({getState,action,enterGame,showDialog,onEnvironment,onError=()=>{}}) {
    Object.assign(this,{getState,action,enterGame,showDialog,onEnvironment,onError});this.route='home';this.busy=false;
    this.draft={...defaults};
    try{this.draft={...this.draft,...JSON.parse(localStorage.getItem('patio-table-draft')||'{}')};}catch{}
    this.writeDraft();
    document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>this.go(b.dataset.back));
    // Jugar ahora: straight to a table with your last saved conditions. Online matchmaking does not exist yet.
    $('home-quick').onclick=()=>this.quickPlay();
    for(const id of ['home-create','choice-create'])$(id).onclick=()=>this.go('config');
    for(const id of ['home-practice','choice-practice','join-practice'])$(id).onclick=()=>this.practice();
    $('home-join').onclick=()=>this.go('join');$('home-profile').onclick=()=>this.go('profile');
    $('home-help').onclick=()=>showDialog('help-dialog');$('home-settings').onclick=()=>showDialog('settings-dialog');
    $('resume').onclick=()=>this.play();$('ready').onclick=()=>this.ready();
    $('table-form').onsubmit=e=>{e.preventDefault();this.configure();};
    $('table-form').oninput=()=>this.saveDraft();$('table-form').onchange=()=>{this.saveDraft();this.updatePreview();};
    $('rules-default').onclick=()=>{this.draft={...this.readDraft(),...RULE_DEFAULTS};this.writeDraft();this.saveDraft();};
    $('edit-table').onclick=()=>this.go('config');
    $('leave-lobby').onclick=()=>this.leaveLobby();
    $('game-home').onclick=()=>showDialog('leave-dialog');$('stay-game').onclick=()=>$('leave-dialog').close();
    $('keep-practice').onclick=()=>{$('leave-dialog').close();this.go('home');};
    $('end-practice').onclick=async()=>{if(this.busy)return;this.busy=true;try{await this.action('leave');$('leave-dialog').close();this.go('home');}catch(e){this.onError(e.message);}finally{this.busy=false;}};
    $('profile-name').value=localStorage.getItem('patio-name')||'Mi asiento';
    $('profile-form').onsubmit=e=>{e.preventDefault();const name=$('profile-name').value.trim();if(name.length<2)return;localStorage.setItem('patio-name',name);$('profile-message').textContent='Nombre guardado en este navegador.';this.update(this.getState());};
    $('validate-code').onclick=()=>this.validateCode();$('join-code').onkeydown=e=>{if(e.key==='Enter')this.validateCode();};
    window.addEventListener('popstate',()=>this.go(location.hash.slice(1)||'home',false));
    this.go('home',false);
  }
  go(route,push=true) {
    if(!routes.includes(route))route='home';
    const state=this.getState();
    if(route==='game'&&!state?.accepted)route='home';
    if(route==='lobby'&&(!state?.configured||state.accepted))route=state?.accepted?'home':'config';
    this.route=route;document.body.classList.toggle('outside-game',route!=='game');
    for(const screen of document.querySelectorAll('.app-screen'))screen.hidden=screen.id!=='screen-'+route;
    $('screens').hidden=route==='game';
    if(push)history.pushState(null,'','#'+route);
    if(route==='config'){this.writeDraft();this.updatePreview();}
    if(route==='profile')this.profileStats();
    this.update(state);
  }
  readDraft(){const value={};for(const [key,id] of Object.entries(fields)){const el=$(id);value[key]=el.type==='checkbox'?el.checked:numeric.has(key)?Number(el.value):el.value;}return value;}
  saveDraft(){this.draft=this.readDraft();try{localStorage.setItem('patio-table-draft',JSON.stringify(this.draft));}catch{}this.updateBadge();}
  writeDraft(){for(const [key,id] of Object.entries(fields)){const el=$(id),value=this.draft[key]??defaults[key];if(el.type==='checkbox')el.checked=!!value;else{el.value=String(value);if(el.selectedIndex<0)el.value=String(defaults[key]);}}this.updateBadge();}
  updateBadge(){$('rules-badge').textContent=isDefaultRules(this.draft)?'Patio RD / 1':'Patio RD / 1 con variantes de la casa';}
  updatePreview(){const name=$('table-environment').value;$('environment-preview').dataset.environment=name;$('environment-label').textContent=name==='terrace'?'Terraza frente al mar':name==='club'?'Club de dominó':'Patio de barrio';this.onEnvironment(name);}
  validateCode(){
    const code=$('join-code').value.trim();
    $('join-error').textContent=!code?'Escribe el código que te compartió el anfitrión.':/^[a-f\d]{32}$/i.test(code)?'El formato es válido, pero este cliente aún no puede entrar a mesas en línea. No se creará una conexión ficticia.':'El código tiene 32 caracteres (números 0–9 y letras a–f). Revisa la invitación.';
  }
  async configure() {
    if(this.busy)return;
    this.saveDraft();
    if(!this.draft.name.trim()){$('config-error').textContent='Ponle un nombre a la mesa.';$('table-name').focus();return;}
    this.busy=true;$('create-table').disabled=true;$('config-error').textContent='';
    const previous=this.getState()?.configured&&!this.getState()?.accepted?{...this.getState().settings,seats:this.getState().seats}:null;
    try{await this.action('configure',this.draft);this.announce(previous);this.go('lobby');}catch(e){$('config-error').textContent=e.message;}finally{this.busy=false;$('create-table').disabled=false;}
  }
  // A host edit resets readiness: the human must confirm again, bots re-confirm automatically.
  announce(previous){
    const state=this.getState(),changes=changedConditions(previous,state.settings);
    if(previous&&previous.seats?.map(s=>s.name).join()!==state.seats?.map(s=>s.name).join()&&!changes.includes('parejas'))changes.push('parejas');
    $('lobby-notice').textContent=!previous?'Mesa local con tres bots. Nadie está conectado por Internet, así que no hay código de invitación.':
      changes.length?`Condiciones actualizadas: ${changes.join(', ')}. Todos deben confirmar otra vez; los bots ya lo hicieron.`:'Sin cambios en las condiciones.';
    $('lobby-notice').classList.toggle('notice-changed',!!(previous&&changes.length));
  }
  async leaveLobby(){if(this.busy)return;this.busy=true;try{await this.action('leave');this.go('home');}catch(e){$('lobby-error').textContent=e.message;}finally{this.busy=false;}}
  async quickPlay() {
    if(this.getState()?.accepted){await this.play();return;}
    if(this.busy)return;this.busy=true;
    try{await this.action('configure',{...defaults,...this.draft});this.announce(null);this.go('lobby');}catch(e){this.onError(e.message);}finally{this.busy=false;}
  }
  async practice() {
    if(this.getState()?.accepted){await this.play();return;}
    if(this.busy)return;this.busy=true;
    try{await this.action('configure',practiceDefaults);this.announce(null);this.go('lobby');}catch(e){this.onError(e.message);}finally{this.busy=false;}
  }
  async ready(){if(this.busy)return;this.busy=true;$('ready').disabled=true;$('lobby-error').textContent='';try{await this.action('start');await this.play();}catch(e){$('lobby-error').textContent=e.message;}finally{this.busy=false;$('ready').disabled=false;}}
  async play(){await this.enterGame();this.go('game');this.onEnter?.();}
  renderSeats(state){
    const names=seatNames(state),seats=state.seats??[];
    $('lobby-seats').replaceChildren(...[0,1,2,3].map(seat=>{
      const card=document.createElement('div'),us=seat%2===0;card.className='seat-card '+(us?'team-us':'team-them');
      const ready=seat===0?(state.accepted?'listo':'por confirmar'):'listo automáticamente';
      card.innerHTML='<span></span><strong></strong><small></small>';
      card.children[0].textContent=`ASIENTO ${seat+1} · ${seat===0?'TÚ':seats[seat]?.bot===false?'PERSONA':'BOT'}`;
      card.children[1].textContent=names[seat]+(seat===2?' · tu pareja':'');
      card.children[2].textContent=`Equipo ${us?'nosotros':'ellos'} · ${ready}`;
      return card;
    }));
  }
  update(state) {
    if(!state)return;$('resume').hidden=!state.accepted;
    const s=state.settings;
    if(s&&state.configured){
      this.renderSeats(state);
      $('lobby-name').textContent=s.name;
      $('lobby-summary').innerHTML='<p></p><p></p>';$('lobby-summary').children[0].textContent=conditionsSummary(s)+'.';$('lobby-summary').children[1].textContent=`Reglas ${state.rulesVersion??'patio-rd/1'}: ${rulesSummary(s)}`;
    }
    if(state.result?.finished) {
      let results=[];try{results=JSON.parse(localStorage.getItem('patio-local-results')||'[]');}catch{}
      const id=state.sessionId+':'+state.revision;
      if(!results.some(r=>r.id===id)){results.push({id,won:state.result.winner%2===0,scores:state.scores});try{localStorage.setItem('patio-local-results',JSON.stringify(results.slice(-100)));}catch{}}
    }
  }
  profileStats(){let results=[];try{results=JSON.parse(localStorage.getItem('patio-local-results')||'[]');}catch{}$('profile-stats').textContent=results.length?`${results.length} partidas terminadas en este navegador · ${results.filter(r=>r.won).length} ganadas por tu pareja.`:'Todavía no has terminado partidas en este navegador.';}
}
