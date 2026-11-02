import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeSnapshotResponse,GameClient} from '../../src/Domino.Desktop/wwwroot/game-client.js';
const snapshot={revision:2,accepted:false,settings:{target:200},hand:[],chain:[],moves:[],scores:[0,0]};
test('404 vacío informa servidor antiguo sin SyntaxError',async()=>{
  await assert.rejects(decodeSnapshotResponse(new Response(null,{status:404})),error=>error.message.includes('desactualizado')&&!error.message.includes('JSON input'));
});
test('respuesta vacía, HTML y JSON incompleto no llegan a la presentación',async()=>{
  for(const response of [new Response(null,{status:200}),new Response('<html>Error</html>',{status:500}),new Response('{"revision":',{status:200}),new Response(JSON.stringify({revision:1,hand:[]}),{status:200})])await assert.rejects(decodeSnapshotResponse(response),Error);
});
test('estado válido y validación de reglas conservan el snapshot autorizado',async()=>{
  assert.deepEqual(await decodeSnapshotResponse(new Response(JSON.stringify(snapshot))),snapshot);
  const rejection={...snapshot,error:'Meta inválida'};assert.deepEqual(await decodeSnapshotResponse(new Response(JSON.stringify(rejection),{status:400})),rejection);
  await assert.rejects(decodeSnapshotResponse(new Response(JSON.stringify({title:'Solicitud inválida'}),{status:400})),/Solicitud inválida/);
});
test('un polling fallido no bloquea reintentar crear la mesa',async()=>{
  const original=globalThis.fetch;const seen=[];let requests=0;
  const client=new GameClient(s=>seen.push(s),()=>{});
  client.inflight=Promise.reject(new Error('Error previo de red'));client.inflight.catch(()=>{});
  globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify(snapshot));};
  try{assert.deepEqual(await client.action('configure',{}),snapshot);assert.equal(requests,1);assert.equal(seen.length,1);assert.equal(client.busy,false);}finally{globalThis.fetch=original;}
});
