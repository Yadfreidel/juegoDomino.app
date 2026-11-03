// Same-origin snapshots only; the practice authority (C# PracticeMatch) decides every move.
// It answers over HTTP in the ASP.NET app, or inside the page when a static build (GitHub Pages) ships it
// compiled to WebAssembly. Both transports return a Response, so decoding and errors are shared.
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
export function httpTransport(path,body) {
  return fetch('api/'+path,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000)})
    .catch(error=>{throw new Error(error.name==='TimeoutError'?'El servidor local tardó demasiado en responder. Inténtalo de nuevo.':'No se pudo conectar con el servidor local. Comprueba que la app sigue abierta.');});
}
let bridge=null;
async function loadBridge() {
  const {dotnet}=await import(new URL('_framework/dotnet.js',document.baseURI).href);
  const runtime=await dotnet.create();return (await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName)).Domino.Web.PracticeBridge;
}
export async function browserTransport(path,body) {
  bridge??=loadBridge().catch(error=>{bridge=null;throw new Error('No se pudo iniciar el motor del juego en este navegador: '+error.message);});
  const engine=await bridge,name=path[0].toUpperCase()+path.slice(1);
  if(typeof engine[name]!=='function')return new Response('',{status:404});
  const envelope=JSON.parse(path==='configure'||path==='play'||path==='power'?engine[name](JSON.stringify(body??{})):engine[name]());
  return new Response(envelope.body,{status:envelope.status,headers:{'Content-Type':'application/json'}});
}
// <meta name="patio-engine" content="browser"> is written by the GitHub Pages build.
export function defaultTransport() {
  return typeof document!=='undefined'&&document.querySelector('meta[name="patio-engine"]')?.content==='browser'?browserTransport:httpTransport;
}
export class GameClient {
  constructor(onSnapshot,onError,transport=defaultTransport()){this.onSnapshot=onSnapshot;this.onError=onError;this.transport=transport;this.busy=false;this.stopped=false;this.inflight=null;}
  async request(path,body) {
    const response=await this.transport(path,body);
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
