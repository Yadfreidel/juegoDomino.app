export const POWERS=[
 ['slam','✺','Golpe de mesa','Onda expansiva y salto de las fichas.'],['hurricane','◎','Huracán','Remolino que devuelve cada ficha a su sitio.'],['electric','ϟ','Doble eléctrico','Descarga por los dobles de la cadena.'],['break','▦','Desbarate total','La mesa se separa y se reconstruye.'],
 ['fire','♨','Ficha encendida','Selecciona una ficha colocada: fuego y chispas.'],['ice','❄','Mesa congelada','Escarcha; se rompe en la siguiente jugada.'],['blackhole','◉','Agujero negro','Portal que absorbe y devuelve las fichas.'],['dragon','〰','Dragón dominó','Dragón de humo que sigue la cadena.'],['wave','≋','Ola caribeña','Una ola cruza la mesa.'],['meteor','☄','Ficha meteoro','Selecciona una ficha colocada para su caída.'],
 ['swap','⇄','Cambio de mano','Intercambia una ficha aleatoria con un rival.'],['look','◈','La mirada','Mira una ficha rival durante tres segundos.'],['shield','⬡','Escudo','Bloquea el próximo ataque directo hasta terminar la mano.'],['reverse','↶','Reversa','Invierte el siguiente avance de turnos.'],['deal','⤨','Reparto loco','Redistribuye las manos conservando sus cantidades.']
];
export class ChaosMenu {
 constructor({getState,activate,onError}){
  Object.assign(this,{getState,activate,onError});this.page=0;this.selected=null;this.root=document.getElementById('chaos-menu');this.toggle=document.getElementById('chaos-toggle');
  this.toggle.onclick=()=>this.open(this.root.hidden);this.root.addEventListener('keydown',e=>{if(e.key==='Escape'){this.open(false);this.toggle.focus();}if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const items=[...this.root.querySelectorAll('button:not(:disabled),select')],i=items.indexOf(document.activeElement);items[(i+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}});
  window.addEventListener('chaos-cancel',()=>this.open(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!this.root.hidden){this.open(false);this.toggle.focus();}});
 }
 open(value){this.root.hidden=!value;this.toggle.setAttribute('aria-expanded',String(value));if(value){this.render();this.root.querySelector('button')?.focus();}}
 update(){const s=this.getState();this.toggle.hidden=s?.settings.mode!=='chaos'||!s.accepted||!!s.result;if(this.toggle.hidden)this.open(false);if(!this.root.hidden&&this.revision!==s.revision){this.render();this.revision=s.revision;}}
 render(){
  const s=this.getState(),remaining=s.chaos?.remaining??0,can=s.turn===0&&!s.result&&remaining>0&&s.chaos?.turnRemaining>0;
  const all=POWERS.filter((_,i)=>i<10||s.settings.chaosVariant==='rules'),pages=Math.ceil(all.length/4);this.page%=pages;
  this.root.innerHTML='<header>DOMINÓ CAOS · '+remaining+' usos <button type="button" aria-label="Cerrar poderes">×</button></header><div class="chaos-wheel"></div><div class="chaos-detail"></div><footer></footer>';
  this.root.querySelector('header button').onclick=()=>this.open(false);
  const wheel=this.root.querySelector('.chaos-wheel');all.slice(this.page*4,this.page*4+4).forEach((p,i)=>{const b=document.createElement('button');b.className='chaos-power';b.style.setProperty('--slot',i);b.textContent=p[1]+' '+p[2];b.title=p[3];b.setAttribute('aria-pressed',String(this.selected===p[0]));b.onclick=()=>{this.selected=p[0];this.detail(p,can);};wheel.append(b);});
  const f=this.root.querySelector('footer');for(const [label,delta] of [['←',-1],['→',1]]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',delta<0?'Página anterior':'Página siguiente');b.onclick=()=>{this.page=(this.page+delta+pages)%pages;this.selected=null;this.render();};f.append(b);}f.insertBefore(document.createTextNode(' '+(this.page+1)+' / '+pages+' '),f.lastChild);
  const p=all.find(p=>p[0]===this.selected);if(p)this.detail(p,can);else this.root.querySelector('.chaos-detail').textContent=can?'Elige un poder para consultar y activar.':'No disponible: espera tu turno o no quedan usos.';
 }
 detail(p,can){
  const s=this.getState(),d=this.root.querySelector('.chaos-detail');d.replaceChildren();const text=document.createElement('p');text.textContent=p[3];d.append(text);let select;
  if(['swap','look','fire','meteor'].includes(p[0])){select=document.createElement('select');select.setAttribute('aria-label',['swap','look'].includes(p[0])?'Rival objetivo':'Ficha objetivo');
   const entries=['swap','look'].includes(p[0])?[['1',s.seats[1].name],['3',s.seats[3].name]]:s.chain.map(t=>{const a=Math.min(t.left,t.right),b=Math.max(t.left,t.right);return [a+':'+b,a+'–'+b];});
   for(const [v,label] of entries){const o=document.createElement('option');o.value=v;o.textContent=label;select.append(o);}d.append(select);
  }
  const b=document.createElement('button');b.textContent='Activar · 1 uso';const unavailable=!can?'Espera tu turno o revisa tus usos.':!['swap','look','shield','reverse','deal'].includes(p[0])&&!s.chain.length?'Coloca primero una ficha.':p[0]==='electric'&&!s.chain.some(t=>t.left===t.right)?'Se necesita un doble.':p[0]==='shield'&&s.chaos?.shields[0]?'Ya tienes escudo.':null;b.disabled=!!unavailable;if(unavailable){const note=document.createElement('p');note.textContent=unavailable;d.append(note);}b.onclick=async()=>{b.disabled=true;const c={power:p[0],id:crypto.randomUUID(),revision:s.revision};if(['swap','look'].includes(p[0]))c.target=Number(select.value);if(['fire','meteor'].includes(p[0]))[c.a,c.b]=select.value.split(':').map(Number);try{await this.activate(c);this.open(false);this.toggle.focus();}catch(e){this.onError(e.message);this.render();}};d.append(b);
 }
}
