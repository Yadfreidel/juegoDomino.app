import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TileGeometryCache,pipCentres,TILE_SHAPE} from '../../src/Domino.Desktop/wwwroot/tile-geometry.js';
import {TILE,pipPattern} from '../../src/Domino.Desktop/wwwroot/chain-layout.js';
import {qualityProfile,QUALITY} from '../../src/Domino.Desktop/wwwroot/graphics-quality.js';

// Triangles whose winding disagrees with their stored normal would be culled or lit from behind.
function windingErrors(geometry) {
  const p=geometry.attributes.position,n=geometry.attributes.normal;let bad=0;
  for(let i=0;i<p.count;i+=3) {
    const u=[0,1,2].map(k=>p.getComponent(i+1,k)-p.getComponent(i,k)),v=[0,1,2].map(k=>p.getComponent(i+2,k)-p.getComponent(i,k));
    const f=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(f[0]*n.getX(i)+f[1]*n.getY(i)+f[2]*n.getZ(i)<0)bad++;
  }
  return bad;
}

test('doble seis completo: una cavidad por punto, en su mitad y dentro de la cara',()=>{
  const cache=new TileGeometryCache(),edge=TILE.length/2-TILE_SHAPE.bevel,side=TILE.width/2-TILE_SHAPE.bevel;
  for(let a=0;a<=6;a++)for(let b=a;b<=6;b++) {
    const entry=cache.pair(a,b),centres=pipCentres(a,b);
    assert.equal(entry.pips,a+b);assert.equal(centres.length,pipPattern[a].length+pipPattern[b].length);
    assert.equal(centres.filter(([x])=>x<0).length,a,`mitad izquierda ${a}:${b}`);assert.equal(centres.filter(([x])=>x>0).length,b,`mitad derecha ${a}:${b}`);
    for(const [x,z] of centres)assert.ok(Math.abs(x)+TILE_SHAPE.pipRim<edge&&Math.abs(z)+TILE_SHAPE.pipRim<side,`borde ${a}:${b}`);
    // Neighbouring cavities never merge.
    for(let i=0;i<centres.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(centres[i][0]-centres[j][0],centres[i][1]-centres[j][1])>TILE_SHAPE.pipRim*2,`solape ${a}:${b}`);
    entry.ivory.computeBoundingBox();const box=entry.ivory.boundingBox;
    assert.ok(Math.abs(box.max.y-TILE.height/2)<1e-6&&Math.abs(box.min.y+TILE.height/2)<1e-6,'grosor');
    assert.equal(windingErrors(entry.ivory),0);assert.equal(windingErrors(entry.ink),0);
  }
  assert.equal(cache.cache.size,28);assert.equal(cache.pair(5,2),cache.pair(2,5),'geometría compartida por par');
  assert.equal(windingErrors(cache.reverse),0);cache.dispose();
});

test('perfiles de calidad: límites de resolución y sombras',()=>{
  assert.deepEqual(Object.keys(QUALITY),['low','medium','high']);
  assert.equal(qualityProfile('low',3).pixelRatio,1);assert.equal(qualityProfile('low',3).shadows,false);
  assert.equal(qualityProfile('medium',3).pixelRatio,1.25);assert.equal(qualityProfile('low').reflections,false);assert.equal(qualityProfile('high',1).pixelRatio,1);
  assert.equal(qualityProfile('high',3,4).anisotropy,4);assert.equal(qualityProfile('desconocida').name,'medium');
});
