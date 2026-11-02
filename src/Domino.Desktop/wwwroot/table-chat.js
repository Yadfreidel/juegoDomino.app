import {seatKeys,seatNames} from './table-roster.js';

const $=id=>document.getElementById(id);
// Bot lines are reactions to public events only; they never reveal a hand.
const lines={pass:['Paso.','Me pasaron.','No llevo.'],domino:['¡Dominó!','Se acabó, señores.'],capicua:['¡Capicúa!'],block:['¡Trancao!','Cuenten las pintas.'],run:['¡Paso corrido!']};

export function newEvents(previous,next) {
  if(!previous?.length)return next.slice(-2);
  for(let k=Math.min(previous.length,next.length);k>=0;k--)if(previous.slice(previous.length-k).every((e,i)=>e===next[i]))return next.slice(k);
  return next;
}

// Quick messages for the local table: own reactions plus bot lines, filtered by mute choices.
export class TableChat {
  constructor(preferences){
    this.preferences=preferences;this.timers=new Map();this.events=[];this.hand=0;this.state=null;
    for(let seat=1;seat<4;seat++)$('player-'+seat).querySelector('.mute-toggle').onclick=()=>this.toggleMute(seat);
    document.querySelectorAll('[data-reaction]').forEach(b=>b.onclick=()=>this.say(0,b.dataset.reaction));
  }
  enabled(){return !!this.state?.settings?.quickMessages;}
  muted(seat){return this.preferences.value.mutedPlayers.includes(seatKeys(this.state)[seat]);}
  toggleMute(seat){
    const key=seatKeys(this.state)[seat],list=this.preferences.value.mutedPlayers;
    this.preferences.set({mutedPlayers:list.includes(key)?list.filter(k=>k!==key):[...list,key]});
    if(this.muted(seat))this.clear(seat);this.render();
  }
  render(){
    const names=seatNames(this.state);
    for(let seat=1;seat<4;seat++){const b=$('player-'+seat).querySelector('.mute-toggle'),muted=this.muted(seat);b.hidden=!this.enabled();b.textContent=muted?'🔇':'🔈';b.setAttribute('aria-pressed',String(muted));b.setAttribute('aria-label',(muted?'Volver a escuchar a ':'Silenciar a ')+names[seat]);}
  }
  say(seat,text){
    if(!this.enabled()||(seat>0&&this.muted(seat)))return;
    const out=seat===0?$('reaction-output'):$('player-'+seat).querySelector('.chat-bubble');
    out.textContent=text;out.classList.add('visible');clearTimeout(this.timers.get(seat));this.timers.set(seat,setTimeout(()=>this.clear(seat),2600));
  }
  clear(seat){const out=seat===0?$('reaction-output'):$('player-'+seat).querySelector('.chat-bubble');out.textContent='';out.classList.remove('visible');}
  update(state){
    const fresh=this.state&&state.handNumber===this.hand?newEvents(this.events,state.events):[];
    this.state=state;this.events=state.events;this.hand=state.handNumber;this.render();
    fresh.forEach((event,i)=>this.react(event,fresh[i+1],state));
  }
  react(event,following,state){
    const pick=(list,seed)=>list[seed%list.length];
    const seat=Number(/^Asiento (\d)/.exec(event)?.[1]);
    if(/: Paso$/.test(event)&&seat>0)this.say(seat,pick(lines.pass,state.revision+seat));
    // The bonus event precedes the placement of the player who earned it.
    else if(event.startsWith('Paso corrido +')){const author=Number(/^Asiento (\d)/.exec(following??'')?.[1]??2);this.say(author>0?author:2,lines.run[0]);}
    else if(state.result&&/^(Dominó|Trancao)/.test(event)&&!state.result.isVoid){
      const w=state.result.winner,speaker=w===0?2:w;
      this.say(speaker,state.result.capicua?lines.capicua[0]:pick(state.result.reason==='Trancao'?lines.block:lines.domino,state.revision));
    }
  }
}
