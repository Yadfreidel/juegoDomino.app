import * as THREE from './vendor/three.module.js';

// PBR surfaces for the table and the tiles. Texture sets are CC0 Poly Haven scans kept in
// assets/textures (origin and licence in docs/RECURSOS.md); everything else is generated here once.
const TEXTURE_ROOT='assets/textures/';
// Table units covered by one texture repeat. A tile is 1.06 units long (about 5 cm), so the
// walnut sheet (1 m scan) spans ~45 cm and the linen (27 cm scan) keeps a fine, realistic weave.
export const TEXTURE_SPAN=Object.freeze({wood:9.5,felt:2.6,ivory:1.7});

export class SurfaceTextures {
  constructor(loader=new THREE.TextureLoader()){this.loader=loader;this.textures=[];this.anisotropy=4;}
  load(file,{color=false,span=1}={}) {
    const texture=this.loader.load(TEXTURE_ROOT+file,undefined,undefined,()=>console.warn('Textura no disponible: '+file));
    return this.track(texture,color,span);
  }
  track(texture,color,span) {
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(1/span,1/span);texture.anisotropy=this.anisotropy;this.textures.push(texture);return texture;
  }
  // Colour, roughness and OpenGL-convention normal map with the same physical span.
  set(name,span){return {map:this.load(name+'-color.jpg',{color:true,span}),roughnessMap:this.load(name+'-rugosidad.jpg',{span}),normalMap:this.load(name+'-normal.jpg',{span})};}
  setAnisotropy(value) {
    this.anisotropy=value;
    // Images still loading pick the value up on their first upload; loaded ones need a re-upload.
    for(const t of this.textures)if(t.anisotropy!==value){t.anisotropy=value;if(t.image)t.needsUpdate=true;}
  }
  dispose(){for(const t of this.textures)t.dispose();this.textures=[];}
}

// Table surfaces: varnished wood, matte felt and small trim pieces. Materials are shared by every mesh.
export function createTableMaterials(textures) {
  const wood=textures.set('nogal',TEXTURE_SPAN.wood),felt=textures.set('lino',TEXTURE_SPAN.felt);
  const varnish={clearcoat:.45,clearcoatRoughness:.24};
  const materials={
    // Walnut scan tinted toward a deep mahogany; the clear coat gives the varnish a soft second highlight.
    wood:new THREE.MeshPhysicalMaterial({color:'#c46a4a',...wood,roughness:.62,normalScale:new THREE.Vector2(.55,.55),...varnish}),
    darkWood:new THREE.MeshPhysicalMaterial({color:'#7a3a28',...wood,roughness:.7,normalScale:new THREE.Vector2(.5,.5),...varnish,clearcoat:.3}),
    // Fine woven cloth: albedo is greyscale so the colour lives here; fully matte.
    felt:new THREE.MeshStandardMaterial({color:'#2b7343',...felt,roughness:1.2,normalScale:new THREE.Vector2(.9,.9)}),
    brass:new THREE.MeshStandardMaterial({color:'#c9a25e',metalness:1,roughness:.38}),
    red:new THREE.MeshStandardMaterial({color:'#ce1126',roughness:.5}),
    white:new THREE.MeshStandardMaterial({color:'#f2eee4',roughness:.5}),
    blue:new THREE.MeshStandardMaterial({color:'#002d62',roughness:.5}),
    shadow:new THREE.MeshBasicMaterial({map:softShadowTexture(256,192,.2,.3),transparent:true,depthWrite:false,toneMapped:false,opacity:.62}),
    rackShadow:new THREE.MeshBasicMaterial({map:softShadowTexture(256,64,.25,.32),transparent:true,depthWrite:false,toneMapped:false,opacity:.5}),
    // Occlusion where the felt meets the frame: darker at the rail, clear well before the chain area.
    feltEdge:new THREE.MeshBasicMaterial({map:softShadowTexture(512,320,.06,.07,true),transparent:true,depthWrite:false,toneMapped:false,opacity:.55})
  };
  materials.coated=[materials.wood,materials.darkWood];
  return materials;
}

// Tile surfaces. Three ivory variants (tint, roughness and grain offset) give each piece its own
// character; values are chosen per tile identity, so a tile never changes look between snapshots.
export function createTileMaterials() {
  const grain=ivoryGrain(),roughness=ivoryRoughness();
  for(const t of [grain,roughness]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/TEXTURE_SPAN.ivory,1/TEXTURE_SPAN.ivory);}
  grain.colorSpace=THREE.SRGBColorSpace;
  const ivory=[['#f3ead6',.36,[0,0]],['#efe4cc',.4,[.37,.61]],['#f5eedd',.33,[.71,.23]]].map(([color,rough,[u,v]])=>{
    const map=grain.clone(),roughnessMap=roughness.clone();map.offset.set(u,v);roughnessMap.offset.set(u,v);
    return new THREE.MeshPhysicalMaterial({color,map,roughnessMap,roughness:rough,clearcoat:.25,clearcoatRoughness:.32});
  });
  return {
    ivory,grain,roughness,
    // Painted cavities: near black, rough enough that no highlight hides a pip.
    ink:new THREE.MeshStandardMaterial({color:'#0b0a09',roughness:.78,side:THREE.DoubleSide}),
    // Low-contrast inlay on reverses: a dark mark there would read as a pip and suggest a value.
    emblem:new THREE.MeshStandardMaterial({color:'#d8bf8c',roughness:.45}),
    contact:new THREE.MeshBasicMaterial({map:softShadowTexture(128,64,.26,.36),transparent:true,depthWrite:false,toneMapped:false,opacity:.78,polygonOffset:true,polygonOffsetFactor:-1}),
    // Placement preview: a light mint tint over ivory, translucent but with fully dark pips.
    ghostIvory:new THREE.MeshStandardMaterial({color:'#cdeedb',transparent:true,opacity:.62,depthWrite:false,roughness:.5,emissive:'#2f7152',emissiveIntensity:.18}),
    ghostInk:new THREE.MeshStandardMaterial({color:'#0f2a1f',transparent:true,opacity:.92,depthWrite:false,roughness:.7,side:THREE.DoubleSide})
  };
}

export function setClearcoat(materials,enabled) {
  for(const m of materials) {
    m.userData.clearcoat??=m.clearcoat;const next=enabled?m.userData.clearcoat:0;
    // Crossing zero toggles a shader define, so only then is a recompilation needed.
    if((m.clearcoat>0)!==(next>0))m.needsUpdate=true;m.clearcoat=next;
  }
}
export function disposeMaterials(list) {
  const textures=new Set();
  for(const m of list){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
  for(const t of textures)t.dispose();
}

// Soft rounded-rectangle shadow: alpha falls off with the distance to the inner rectangle.
// `inner` and `soft` are fractions of the texture height. `invert` darkens the border instead (a vignette).
export function softShadowTexture(width,height,inner,soft,invert=false) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height),hx=width/2-height*(inner+soft),hy=height/2-height*(inner+soft),r=height*inner,fade=height*soft;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const dx=Math.max(Math.abs(x+.5-width/2)-hx,0),dy=Math.max(Math.abs(y+.5-height/2)-hy,0),d=Math.hypot(dx,dy)-r;
    const t=Math.min(1,Math.max(0,1-d/fade)),i=(y*width+x)*4;const a=t*t*(3-2*t);image.data[i+3]=Math.round(255*(invert?1-a:a*.85));
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
// Tileable value noise, summed over a few octaves.
function noiseField(size,seed,octaves) {
  const rand=seeded(seed),field=new Float32Array(size*size);let total=0;
  for(const [cells,weight] of octaves) {
    const grid=Array.from({length:cells*cells},rand),at=(x,y)=>grid[(y%cells)*cells+(x%cells)];total+=weight;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const fx=x/size*cells,fy=y/size*cells,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);
      const top=at(ix,iy)+(at(ix+1,iy)-at(ix,iy))*sx,bottom=at(ix,iy+1)+(at(ix+1,iy+1)-at(ix,iy+1))*sx;field[y*size+x]+=(top+(bottom-top)*sy)*weight;
    }
  }
  for(let i=0;i<field.length;i++)field[i]/=total;return field;
}
function fieldTexture(size,field,toRgb) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);
  for(let i=0;i<field.length;i++){const [r,g,b]=toRgb(field[i]);image.data.set([r,g,b,255],i*4);}
  ctx.putImageData(image,0,0);return new THREE.CanvasTexture(canvas);
}
// Faint cloudy mottling with fine streaks, the way aged bone or cast resin varies. Contrast stays
// within a few percent so faces remain uniformly light and pips keep their contrast.
function ivoryGrain() {
  const size=256,clouds=noiseField(size,7,[[4,.55],[9,.3],[23,.15]]),streaks=noiseField(size,19,[[64,1]]);
  return fieldTexture(size,clouds.map((v,i)=>v*.8+streaks[i]*.2),v=>{const k=.93+v*.07;return [255*k,251*k,243*k].map(Math.round);});
}
function ivoryRoughness() {
  const size=128,field=noiseField(size,31,[[6,.6],[17,.4]]);
  return fieldTexture(size,field,v=>{const g=Math.round(255*(.82+v*.18));return [g,g,g];});
}
