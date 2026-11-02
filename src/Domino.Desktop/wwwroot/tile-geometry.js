import * as THREE from './vendor/three.module.js';
import {TILE,pipPattern} from './chain-layout.js';

// Physical tile shape, shared by every domino. Pips are real cavities: the top face has a hole per
// pip, an ivory chamfer rounds the rim and a black cup closes it. Built once per value pair and cached.
export const TILE_SHAPE=Object.freeze({corner:.075,bevel:.024,pipRim:.056,pipWall:.044,rimDepth:.007,pipDepth:.032,pipStep:{x:.125,z:.14},halfOffset:.265,groove:{width:.016,length:.4,depth:.012},segments:16});

// Rounded rectangle extruded along Y with a soft bevel, smooth-shaded and centred on the origin.
export function roundedSlab(w,h,d,r,bevel,segments=4) {
  const shape=roundedRect(w-bevel*2,d-bevel*2,Math.max(.01,r-bevel));
  const g=new THREE.ExtrudeGeometry(shape,{depth:h-bevel*2,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:segments,curveSegments:8});
  g.rotateX(-Math.PI/2);g.translate(0,-(h-bevel*2)/2,0);return smoothNormals(g);
}
export function roundedRect(w,h,r,cx=0,cy=0,path=new THREE.Shape()) {
  const x=cx-w/2,y=cy-h/2,q=Math.PI/2;
  path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.absarc(x+w-r,y+r,r,-q,0,false);path.lineTo(x+w,y+h-r);path.absarc(x+w-r,y+h-r,r,0,q,false);
  path.lineTo(x+r,y+h);path.absarc(x+r,y+h-r,r,q,2*q,false);path.lineTo(x,y+r);path.absarc(x+r,y+r,r,2*q,3*q,false);
  return path;
}

// Extrusions arrive flat-shaded. Average normals of faces sharing a position when they bend less than
// `crease`, so bevels read as one soft curve while square edges stay crisp.
export function smoothNormals(geometry,crease=Math.PI/3) {
  const g=geometry.index?geometry.toNonIndexed():geometry;g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,count=p.count,key=i=>`${Math.round(p.getX(i)*1e4)},${Math.round(p.getY(i)*1e4)},${Math.round(p.getZ(i)*1e4)}`;
  const faces=[],units=[],shared=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);const f=new THREE.Vector3().subVectors(c,b).cross(a.sub(b));faces.push(f);units.push(f.clone().normalize());}
  for(let i=0;i<count;i++){const k=key(i);if(!shared.has(k))shared.set(k,[]);shared.get(k).push(i);}
  const limit=Math.cos(crease),out=new Float32Array(count*3),sum=new THREE.Vector3();
  for(let i=0;i<count;i++) {
    const own=units[(i/3)|0];sum.set(0,0,0);
    for(const j of shared.get(key(i)))if(units[(j/3)|0].dot(own)>=limit)sum.add(faces[(j/3)|0]);
    sum.normalize();out[i*3]=sum.x;out[i*3+1]=sum.y;out[i*3+2]=sum.z;
  }
  n.array.set(out);n.needsUpdate=true;return planarUV(g);
}

// World-scale UVs (one unit = one texture repeat) projected along each vertex's dominant axis,
// so wood grain and fabric keep the same physical size on every part of the table.
export function planarUV(geometry,scale=1) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++) {
    const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
    const [u,v]=ay>=ax&&ay>=az?[p.getX(i),-p.getZ(i)]:az>=ax?[p.getX(i),p.getY(i)]:[p.getZ(i),p.getY(i)];
    uv[i*2]=u*scale;uv[i*2+1]=v*scale;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}

// Concatenates non-indexed geometries with position, normal and uv.
export function concatGeometries(list) {
  const parts=list.map(g=>g.index?g.toNonIndexed():g),total=parts.reduce((s,g)=>s+g.attributes.position.count,0),out=new THREE.BufferGeometry();
  for(const [name,size] of [['position',3],['normal',3],['uv',2]]) {
    const array=new Float32Array(total*size);let offset=0;
    for(const g of parts){const source=g.attributes[name];if(source)array.set(source.array,offset);offset+=g.attributes.position.count*size;}
    out.setAttribute(name,new THREE.BufferAttribute(array,size));
  }
  for(const g of [...parts,...list])g.dispose();out.computeBoundingSphere();return out;
}
function withoutTriangles(geometry,drop) {
  const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position,keep=[];
  for(let i=0;i<p.count;i+=3)if(!drop(i,p))keep.push(i);
  const out=new THREE.BufferGeometry();
  for(const name of ['position','normal','uv']){const s=g.attributes[name];if(!s)continue;const size=s.itemSize,array=new Float32Array(keep.length*3*size);keep.forEach((start,k)=>array.set(s.array.subarray(start*size,(start+3)*size),k*3*size));out.setAttribute(name,new THREE.BufferAttribute(array,size));}
  g.dispose();if(g!==geometry)geometry.dispose();return out;
}
// Lathe around Y from (radius, y) pairs. Its 16 rim vertices land on the same angles as a 16-step shape circle.
function lathe(profile,segments) {
  const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);return g.toNonIndexed();
}
function moved(geometry,x,y,z){return geometry.clone().translate(x,y,z);}

export function pipCentres(left,right) {
  const {pipStep,halfOffset}=TILE_SHAPE,out=[];
  for(const [value,offset] of [[left,-halfOffset],[right,halfOffset]])for(const [x,z] of pipPattern[value])out.push([offset+x*pipStep.x,z*pipStep.z]);
  return out;
}

export class TileGeometryCache {
  constructor() {
    const s=TILE_SHAPE,top=TILE.height/2;this.top=top;this.cache=new Map();
    // Full slab for reverses; the face variant drops its flat top so the cap with holes replaces it.
    this.reverse=roundedSlab(TILE.length,TILE.height,TILE.width,s.corner,s.bevel);
    this.body=withoutTriangles(roundedSlab(TILE.length,TILE.height,TILE.width,s.corner,s.bevel),(i,p)=>p.getY(i)>top-1e-5&&p.getY(i+1)>top-1e-5&&p.getY(i+2)>top-1e-5);
    // Soft ivory rim around every hole, then the painted cup inside it.
    this.rim=lathe([[s.pipRim,0],[s.pipRim-.0045,-.0012],[s.pipWall+.003,-.0042],[s.pipWall,-s.rimDepth]],s.segments);
    this.cup=lathe([[s.pipWall,-s.rimDepth],[s.pipWall,-s.pipDepth+.008],[s.pipWall*.78,-s.pipDepth+.0012],[0,-s.pipDepth]],s.segments);
    const g=s.groove,walls=new THREE.BoxGeometry(g.width,g.depth,g.length).translate(0,-g.depth/2,0);
    this.grooveWalls=withoutTriangles(walls,(i,p)=>p.getY(i)>-1e-5&&p.getY(i+1)>-1e-5&&p.getY(i+2)>-1e-5);
  }
  // Geometry for the unordered pair: lower value on the left half. Callers rotate it 180° for the other order.
  pair(left,right) {
    const a=Math.min(left,right),b=Math.max(left,right),key=a+':'+b;
    if(this.cache.has(key))return this.cache.get(key);
    const s=TILE_SHAPE,top=this.top,centres=pipCentres(a,b);
    const cap=roundedRect(TILE.length-s.bevel*2,TILE.width-s.bevel*2,s.corner-s.bevel);
    // Shape space is (x, -z) because the cap is rotated onto the XZ plane afterwards.
    for(const [x,z] of centres)cap.holes.push(new THREE.Path().absarc(x,-z,s.pipRim,0,Math.PI*2,true));
    const gw=s.groove.width/2,gl=s.groove.length/2;cap.holes.push(new THREE.Path().moveTo(-gw,-gl).lineTo(-gw,gl).lineTo(gw,gl).lineTo(gw,-gl).lineTo(-gw,-gl));
    const capGeometry=new THREE.ShapeGeometry(cap,s.segments/2);capGeometry.rotateX(-Math.PI/2);capGeometry.translate(0,top,0);
    const ivory=concatGeometries([this.body.clone(),planarUV(capGeometry),...centres.map(([x,z])=>moved(this.rim,x,top,z))]);
    const ink=concatGeometries([...centres.map(([x,z])=>moved(this.cup,x,top,z)),moved(this.grooveWalls,0,top,0)]);
    const entry={ivory,ink,pips:centres.length};this.cache.set(key,entry);return entry;
  }
  dispose(){for(const {ivory,ink} of this.cache.values()){ivory.dispose();ink.dispose();}this.cache.clear();for(const g of [this.reverse,this.body,this.rim,this.cup,this.grooveWalls])g.dispose();}
}
