// Same-origin snapshots only; the server remains the authority for every move.
function isSnapshot(value) {
  return value&&Number.isInteger(value.revision)&&typeof value.accepted==='boolean'&&value.settings&&
    Array.isArray(value.hand)&&Array.isArray(value.chain)&&Array.isArray(value.moves)&&Array.isArray(value.scores);
}
function responseError(status) {
  if(status===404)return 'El servidor de esta dirección está desactualizado: no tiene esta función. Reinicia la app con tools/play.ps1 -Restart y recarga la página.';
  if(status>=500)return `El servidor no pudo completar la solicitud (HTTP ${status}). Inténtalo de nuevo.`;
  return `El servidor no devolvió un estado de partida válido (HTTP ${status}). Recarga la página y comprueba que el servidor está actualizado.`;
}
export async function decodeSnapshotResponse(response) {
  const text=await response.text();
  if(!text.trim())throw new Error(responseError(response.status));
  let snapshot;
  try{snapshot=JSON.parse(text);}catch{throw new Error(responseError(response.status));}
  if(!isSnapshot(snapshot)) {
    const detail=!response.ok&&(snapshot?.detail||snapshot?.title||snapshot?.error);
    throw new Error(typeof detail==='string'?detail:responseError(response.status));
  }
  return snapshot;
}
export class GameClient {
  constructor(onSnapshot,onError){this.onSnapshot=onSnapshot;this.onError=onError;this.busy=false;this.stopped=false;this.inflight=null;}
  async request(path,body) {
    let response;
    try{response=await fetch('/api/'+path,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000)});}
    catch(error){throw new Error(error.name==='TimeoutError'?'El servidor local tardó demasiado en responder. Inténtalo de nuevo.':'No se pudo conectar con el servidor local. Comprueba que la app sigue abierta.');}
    const snapshot=await decodeSnapshotResponse(response);this.onSnapshot(snapshot);
    if(!response.ok)throw new Error(snapshot.error||'No se pudo completar la acción.');return snapshot;
  }
  async action(path,body={}) {
    if(this.busy)throw new Error('La jugada se está enviando.');this.busy=true;
    try {try{await this.inflight;}catch{/* A failed poll must not block a later user retry. */}return await this.request(path,body);}finally{this.busy=false;}
  }
  async poll() {
    if(this.stopped)return;
    try{if(!this.busy){this.inflight=this.request('game');await this.inflight;}}catch(e){this.onError(e);}finally{this.inflight=null;if(!this.stopped)this.timer=setTimeout(()=>this.poll(),450);}
  }
  stop(){this.stopped=true;clearTimeout(this.timer);}
}
