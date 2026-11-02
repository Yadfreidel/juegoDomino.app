import * as THREE from './vendor/three.module.js';
import {TILE} from './chain-layout.js';
import {TileGeometryCache} from './tile-geometry.js';
import {createTileMaterials,disposeMaterials,setClearcoat} from './materials.js';
export {roundedRect,roundedSlab} from './tile-geometry.js';

// Builds domino meshes. Face geometry (pips) only exists for tiles the player may see:
// the chain, previews and the drag copy. Rival and partner tiles use reverse() without pips.
// Each face is two draw calls (ivory body with cavities, black paint) plus its contact shadow.
export class TilePresenter {
  constructor() {
    this.geometry=new TileGeometryCache();this.materials=createTileMaterials();
    this.emblem=new THREE.CircleGeometry(.09,24);this.emblem.rotateX(-Math.PI/2);
    this.contact=new THREE.PlaneGeometry(1.24,.62);this.contact.rotateX(-Math.PI/2);
  }
  face(left,right,parent,ghost=false) {
    const m=this.materials,g=new THREE.Group();parent.add(g);
    // Orientation and the small per-tile variation live on an inner node, so the scene keeps full
    // control of the outer position and rotation.
    const orient=new THREE.Group();g.add(orient);
    const pair=this.geometry.pair(left,right);
    const body=new THREE.Mesh(pair.ivory,ghost?m.ghostIvory:m.ivory[0]);body.castShadow=!ghost;body.receiveShadow=true;
    const paint=new THREE.Mesh(pair.ink,ghost?m.ghostInk:m.ink);paint.receiveShadow=!ghost;paint.userData.face=true;
    orient.add(body,paint);
    if(!ghost){const shadow=new THREE.Mesh(this.contact,m.contact);shadow.position.y=-TILE.height/2+.006;shadow.renderOrder=-1;g.add(shadow);}
    Object.assign(g.userData,{orient,body,paint,ghost});this.setFace(g,left,right);return g;
  }
  setFace(g,left,right) {
    const {orient,body,paint,ghost}=g.userData,pair=this.geometry.pair(left,right),seed=hash(Math.min(left,right),Math.max(left,right));
    body.geometry=pair.ivory;paint.geometry=pair.ink;
    if(!ghost)body.material=this.materials.ivory[seed%3];
    // The cached geometry has the lower value on the left; the reversed order is the same piece turned 180°.
    // A sub-degree twist keeps a long chain from looking machine-placed without moving any footprint.
    orient.rotation.y=(left>right?Math.PI:0)+(ghost?0:((seed>>3)%7-3)*.0035);
  }
  // A reverse only: plain ivory with a small brass emblem, no face geometry at all.
  reverse(parent) {
    const g=new THREE.Group();parent.add(g);
    const body=new THREE.Mesh(this.geometry.reverse,this.materials.ivory[0]);body.castShadow=true;body.receiveShadow=true;g.add(body);
    const emblem=new THREE.Mesh(this.emblem,this.materials.emblem);emblem.position.y=TILE.height/2+.002;g.add(emblem);
    return g;
  }
  applyQuality(profile){setClearcoat(this.materials.ivory,profile.clearcoat);}
  dispose() {
    const m=this.materials;this.geometry.dispose();this.emblem.dispose();this.contact.dispose();
    disposeMaterials([...m.ivory,m.ink,m.emblem,m.contact,m.ghostIvory,m.ghostInk]);m.grain.dispose();m.roughness.dispose();
  }
}
function hash(a,b){let h=(a*7+b)*2654435761>>>0;h^=h>>>13;return h>>>0;}
