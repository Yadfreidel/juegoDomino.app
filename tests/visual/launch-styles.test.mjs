import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LAUNCH_STYLES,launchFrame,launchStyle,DEFAULT_LAUNCH} from '../../src/Domino.Desktop/wwwroot/launch-styles.js';

test('cuatro estilos de lanzamiento: duración 250–600 ms y final exacto en la pose del motor',()=>{
  assert.deepEqual(Object.keys(LAUNCH_STYLES),['suave','golpe','giro','deslizar']);
  for(const name of Object.keys(LAUNCH_STYLES)) {
    const s=LAUNCH_STYLES[name];assert.ok(s.duration>=.25&&s.duration<=.6,`${name}: ${s.duration}`);
    // Ends on the target: whole path, no lift, no extra rotation. Never overshoots or ends early.
    assert.deepEqual(launchFrame(name,1),{f:1,lift:0,turn:0});assert.deepEqual(launchFrame(name,7),{f:1,lift:0,turn:0});
    const start=launchFrame(name,0);assert.equal(start.f,0);
    let previous=0;
    for(let i=1;i<=100;i++){const k=launchFrame(name,i/100);assert.ok(k.f>=previous-1e-9&&k.f<=1,`${name} avanza siempre`);assert.ok(k.lift>=0&&k.lift<=s.height+.03,`${name} altura acotada`);previous=k.f;}
  }
});
test('estilos visualmente distintos y valor desconocido seguro',()=>{
  const mid=n=>launchFrame(n,.5);
  assert.ok(mid('deslizar').lift<.05,'deslizar va pegado al tapete');assert.ok(mid('golpe').lift>mid('suave').lift,'golpe cae desde más alto');
  assert.ok(Math.abs(mid('giro').turn)>1,'giro rota durante el recorrido');assert.equal(mid('suave').turn,0);
  assert.equal(launchStyle('cohete'),DEFAULT_LAUNCH);assert.equal(launchStyle('golpe'),'golpe');
});
