export function sameTile(a,b){return !!a&&!!b&&a.a===b.a&&a.b===b.b;}
export function legalEnds(state,tile) {
  if(!state?.accepted||state.result||state.turn!==0||!tile)return [];
  return [...new Set(state.moves.filter(m=>sameTile(m,tile)).map(m=>m.end))].filter(e=>state.chain.length||e==='left');
}

// Owns pointer lifetimes and the request lock, not domino legality.
export class PlacementController {
  constructor({scene,getState,onChange,onSubmit,onSound,needsConfirmation}) {
    Object.assign(this,{scene,getState,onChange,onSubmit,onSound,needsConfirmation});
    this.selected=null;this.chosen=null;this.pending=false;this.drag=null;this.busy=false;this.suppressClickUntil=0;
    this.move=e=>this.pointerMove(e);this.up=e=>this.pointerUp(e);this.abort=e=>this.pointerCancel(e);
    window.addEventListener('pointermove',this.move,{passive:false});window.addEventListener('pointerup',this.up);window.addEventListener('pointercancel',this.abort);
    this.lostFocus=()=>this.cancel();window.addEventListener('blur',this.lostFocus);window.addEventListener('resize',this.lostFocus);
  }
  allowed(){const s=this.getState();return s?.accepted&&!s.result&&s.turn===0&&!this.busy&&!this.scene.isPlacing;}
  select(tile) {
    if(!this.allowed())return;
    this.selected=tile;this.chosen=null;this.pending=false;this.onSound?.('select');this.refresh();
  }
  cancel(){this.drag=null;this.selected=null;this.chosen=null;this.pending=false;this.scene.clearDrag();this.refresh();}
  refresh(){const state=this.getState();this.scene.preview(state,this.selected,legalEnds(state,this.selected),this.chosen);this.onChange(this);}
  sync() {
    const s=this.getState();
    if(this.selected&&(!s.hand.some(t=>sameTile(t,this.selected))||s.turn!==0||s.result)){this.cancel();return;}
    this.refresh();
  }
  pointerDown(e,tile) {
    if(!this.allowed()||e.button!==0)return;
    this.select(tile);this.drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};
    e.preventDefault();
  }
  pointerMove(e) {
    if(!this.drag||this.drag.id!==e.pointerId)return;
    if(!this.allowed()){this.cancel();return;}
    const d=this.drag;
    if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<8)return;
    d.moved=true;this.suppressClickUntil=performance.now()+300;e.preventDefault();
    const end=this.scene.hitDestination(e.clientX,e.clientY,76);
    this.chosen=end;this.scene.moveDrag(e.clientX,e.clientY,this.selected,end);this.onChange(this);
  }
  async pointerUp(e) {
    if(!this.drag||this.drag.id!==e.pointerId)return;
    const moved=this.drag.moved;this.drag=null;
    if(!moved)return;
    this.suppressClickUntil=performance.now()+350;const end=this.scene.hitDestination(e.clientX,e.clientY,76);
    this.scene.clearDrag();
    if(end)await this.place(end);else this.cancel();
  }
  pointerCancel(e){if(this.drag?.id===e.pointerId){this.suppressClickUntil=performance.now()+300;this.cancel();}}
  async place(end,confirmed=false) {
    if(!this.allowed()||!legalEnds(this.getState(),this.selected).includes(end))return;
    this.chosen=end;
    if(this.needsConfirmation()&&!confirmed){this.pending=true;this.refresh();return;}
    const s=this.getState();const command={revision:s.revision,a:this.selected.a,b:this.selected.b,end};
    this.busy=true;this.pending=false;this.refresh();
    try {await this.onSubmit(command);}finally{this.busy=false;this.cancel();}
  }
  dispose(){window.removeEventListener('pointermove',this.move);window.removeEventListener('pointerup',this.up);window.removeEventListener('pointercancel',this.abort);window.removeEventListener('blur',this.lostFocus);window.removeEventListener('resize',this.lostFocus);}
}
