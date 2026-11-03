import * as THREE from './vendor/three.module.js';
import {TILE} from './chain-layout.js';
import {roundedRect,roundedSlab,smoothNormals} from './tile-geometry.js';

const RAIL=1.45,CHAMFER=1.25,FRAME_TOP=2.42,FELT_TOP=2.09;
// One table shape per screen orientation: wide for landscape, tall for portrait. Seats never move:
// 0 (me) is always nearest the camera, 2 (partner) opposite, 1 and 3 the rivals on the sides.
function tableLayout(name,fx,fz) {
  const ox=fx+RAIL,oz=fz+RAIL,flagZ=fz+.72;
  return Object.freeze({
    name,feltHalf:{x:fx,z:fz},outerHalf:{x:ox,z:oz},frameTop:FRAME_TOP,feltTop:FELT_TOP,
    // Full frame outline: must fit the usable width.
    outline:[[-ox,-(oz-CHAMFER)],[-(ox-CHAMFER),-oz],[ox-CHAMFER,-oz],[ox,-(oz-CHAMFER)],[ox,oz-CHAMFER],[ox-CHAMFER,oz],[-(ox-CHAMFER),oz],[-ox,oz-CHAMFER]],
    // Must stay between the top HUD and my rack: the far rail, the whole felt and the flag on the near rail.
    playArea:[[-ox,-(oz-CHAMFER),FRAME_TOP],[-(ox-CHAMFER),-oz,FRAME_TOP],[ox-CHAMFER,-oz,FRAME_TOP],[ox,-(oz-CHAMFER),FRAME_TOP],[fx,fz,FELT_TOP],[-fx,fz,FELT_TOP],[0,flagZ+.4,FRAME_TOP]],
    // Portrait looks almost straight down so a tall table keeps its proportions on a narrow screen.
    steepest:name==='portrait'?80:70,
    racks:{1:{x:fx+.35,z:0,yaw:Math.PI/2},2:{x:0,z:-(fz+.32),yaw:Math.PI},3:{x:-(fx+.35),z:0,yaw:-Math.PI/2}},
    // Each label sits on the rail at the far end of that player's support, never over its tiles.
    labels:{0:[-2.05,flagZ],1:[fx+.4,-2.95],2:[0,-(fz+.62)],3:[-(fx+.4),-2.95]},
    flagZ
  });
}
export const TABLE_LAYOUTS=Object.freeze({landscape:tableLayout('landscape',5.4,3.3),portrait:tableLayout('portrait',3.3,5.7)});
// Landscape is the reference shape for code that does not care about orientation.
export const TABLE=TABLE_LAYOUTS.landscape;
const FLAG_URL='assets/bandera-republica-dominicana.svg';
const TILT=.75;

// Static table: frame, blue felt, three rival/partner supports and the flag plaque on my rail.
// Materials are shared and owned by the scene; this model owns only its geometry and the flag texture.
// My own tiles are the rack in the HUD, so my side of the rail holds the flag instead of a 3D support.
export class DominoTableModel {
  constructor(tiles,materials,layout=TABLE) {
    this.group=new THREE.Group();this.tiles=tiles;this.disposables=[];this.materials=materials;this.layout=layout;
    this.buildBody();this.buildRacks();this.buildFlag();this.buildContactShadows();
  }
  own(resource){this.disposables.push(resource);return resource;}
  add(geometry,material,position=[0,0,0],shadow=false){const m=new THREE.Mesh(this.own(geometry),material);m.position.set(...position);m.castShadow=shadow;m.receiveShadow=true;this.group.add(m);return m;}
  // Smooth-shaded extrusion with world-scale UVs, so the grain keeps one physical size everywhere.
  extrude(shape,depth,bevel,segments=4){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:segments,curveSegments:24});g.rotateX(-Math.PI/2);return smoothNormals(g);}
  buildBody() {
    const {wood,darkWood,felt}=this.materials,o=this.layout.outerHalf,f=this.layout.feltHalf;
    // Thick varnished frame: rounded outline, felt opening, soft bevel on every edge.
    const frame=roundedRect(o.x*2-.2,o.z*2-.2,1.15);frame.holes.push(roundedRect(f.x*2,f.z*2,.5,0,0,new THREE.Path()));
    this.add(this.extrude(frame,.34,.1,6),wood,[0,1.98,0],true);
    this.add(this.extrude(roundedRect(f.x*2+.3,f.z*2+.3,.6),.05,0),felt,[0,2.04,0]);
    this.add(this.extrude(roundedRect(o.x*2-.6,o.z*2-.6,1),.66,.05,3),darkWood,[0,1.2,0]);
    for(const x of [-(f.x-.2),f.x-.2])for(const z of [-(f.z-.1),f.z-.1])this.add(turned(new THREE.CylinderGeometry(.26,.34,1.2,24),.3,1.2),darkWood,[x,.6,z],true);
  }
  buildRacks() {
    const {wood,darkWood}=this.materials;this.racks=new Map();
    for(const [seat,{x,z,yaw}] of Object.entries(this.layout.racks)) {
      const rack=new THREE.Group();rack.position.set(x,FRAME_TOP,z);rack.rotation.y=yaw;this.group.add(rack);
      const piece=(geometry,material,position)=>{const m=new THREE.Mesh(this.own(geometry),material);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;rack.add(m);return m;};
      piece(roundedSlab(4.6,.1,.74,.06,.022,3),darkWood,[0,.05,0]);
      // Back board on the owner's side: tiles lean against it with their reverse toward the table.
      piece(roundedSlab(4.6,.24,.1,.035,.02,3),wood,[0,.14,.36]);
      for(const side of [-1,1]){const cap=piece(turned(new THREE.CylinderGeometry(.13,.13,.74,20),.13,.74),wood,[side*2.33,.13,0]);cap.rotation.x=Math.PI/2;}
      const shadow=new THREE.Mesh(this.own(new THREE.PlaneGeometry(5,1.05).rotateX(-Math.PI/2)),this.materials.rackShadow);shadow.position.y=.004;shadow.renderOrder=-1;rack.add(shadow);
      const backs=[];
      for(let i=0;i<7;i++){
        // Each tile leans back toward its owner, blue reverse up and toward the table: no face geometry exists.
        const t=this.tiles.reverse(rack);t.quaternion.setFromEuler(new THREE.Euler(TILT,0,0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-Math.PI/2,Math.PI/2)));
        t.position.set(0,.1+TILE.length/2*Math.cos(TILT)+TILE.height/2*Math.sin(TILT),.04);backs.push(t);
      }
      this.racks.set(Number(seat),{group:rack,backs});
    }
  }
  buildFlag() {
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;
    const texture=this.own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f4f1ea';ctx.fillRect(0,0,900,600);
    const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,900,600);texture.needsUpdate=true;this.onChange?.();};image.src=FLAG_URL;
    const plaque=new THREE.PlaneGeometry(1.14,.76);plaque.rotateX(-Math.PI/2);
    // Centred on my rail, framed in brass like the reference; printed enamel so it never glares.
    const z=this.layout.flagZ;
    this.add(roundedSlab(1.32,.04,.94,.08,.014,2),this.materials.brass,[0,FRAME_TOP+.006,z],true);
    this.add(plaque,this.own(new THREE.MeshStandardMaterial({map:texture,roughness:.7})),[0,FRAME_TOP+.028,z]);
  }
  // Baked soft occlusion: under the table on the floor (racks carry their own). Visible on every quality
  // level, so objects keep their weight even where real-time shadows are off.
  buildContactShadows() {
    const o=this.layout.outerHalf,f=this.layout.feltHalf;
    const floor=new THREE.Mesh(this.own(new THREE.PlaneGeometry(o.x*2+2.8,o.z*2+2.9).rotateX(-Math.PI/2)),this.materials.shadow);floor.position.y=.045;floor.renderOrder=-1;this.group.add(floor);
    const edge=new THREE.Mesh(this.own(new THREE.PlaneGeometry(f.x*2,f.z*2).rotateX(-Math.PI/2)),this.materials.feltEdge);edge.position.y=FELT_TOP+.003;edge.renderOrder=-1;this.group.add(edge);
  }
  setCounts(counts){for(const [seat,{backs}] of this.racks)backs.forEach((b,i)=>{b.visible=i<counts[seat];b.position.x=(i-(counts[seat]-1)/2)*.6;});}
  rackPoint(seat){const r=this.layout.racks[seat]??{x:0,z:this.layout.outerHalf.z};return new THREE.Vector3(r.x,FRAME_TOP+.4,r.z);}
  labelAnchors(){return Object.entries(this.layout.labels).map(([seat,[x,z]])=>({seat:Number(seat),point:new THREE.Vector3(x,FRAME_TOP+.05,z)}));}
  dispose(){for(const r of this.disposables){if(r.map&&!this.disposables.includes(r.map))r.map.dispose();r.dispose();}}
}

// Cylinder UVs in table units with the grain running along its length.
function turned(geometry,radius,length) {
  const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,v*length,u*Math.PI*2*radius);}
  return geometry;
}
