import * as THREE from './vendor/three.module.js';
import {TILE} from './chain-layout.js';
import {roundedRect,roundedSlab,smoothNormals} from './tile-geometry.js';

// Dimensions shared with the camera framing. Felt top sits just under TILE.y.
export const TABLE=Object.freeze({
  feltHalf:{x:5.4,z:3.3},outerHalf:{x:6.85,z:4.75},frameTop:2.42,feltTop:2.09,
  // Full frame outline: must fit the usable width.
  outline:[[-6.85,-3.5],[-5.6,-4.75],[5.6,-4.75],[6.85,-3.5],[6.85,3.5],[5.6,4.75],[-5.6,4.75],[-6.85,3.5]],
  // Must stay between the scoreboard and the hand: the far rail and the whole playing felt.
  // The near rail (own support) may sit behind the player's hand, like tiles held at the edge.
  playArea:[[-6.85,-3.5,2.42],[-5.6,-4.75,2.42],[5.6,-4.75,2.42],[6.85,-3.5,2.42],[5.4,3.3,2.09],[-5.4,3.3,2.09]],
  flagX:-4.85
});
const RACKS={0:{x:0,z:3.62,yaw:0},1:{x:5.75,z:0,yaw:Math.PI/2},2:{x:0,z:-3.62,yaw:Math.PI},3:{x:-5.75,z:0,yaw:-Math.PI/2}};
// Beside each support, never over its reverses.
const LABELS={1:[6.15,-2.85],2:[-3.55,-4.4],3:[-6.15,-2.85]};
const FLAG_URL='assets/bandera-republica-dominicana.svg';
const TILT=.75;

// Static table: frame, felt, four low supports, flag and tricolour details. Materials are shared and
// owned by the scene; this model owns only its geometry and the flag texture.
export class DominoTableModel {
  constructor(tiles,materials) {
    this.group=new THREE.Group();this.tiles=tiles;this.disposables=[];this.materials=materials;
    this.buildBody();this.buildRacks();this.buildFlag();this.buildTricolour();this.buildContactShadows();
  }
  own(resource){this.disposables.push(resource);return resource;}
  add(geometry,material,position=[0,0,0],shadow=false){const m=new THREE.Mesh(this.own(geometry),material);m.position.set(...position);m.castShadow=shadow;m.receiveShadow=true;this.group.add(m);return m;}
  // Smooth-shaded extrusion with world-scale UVs, so the grain keeps one physical size everywhere.
  extrude(shape,depth,bevel,segments=4){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:segments,curveSegments:24});g.rotateX(-Math.PI/2);return smoothNormals(g);}
  buildBody() {
    const {wood,darkWood,felt}=this.materials,o=TABLE.outerHalf,f=TABLE.feltHalf;
    // Thick varnished frame: rounded outline, felt opening, soft bevel on every edge.
    const frame=roundedRect(o.x*2-.2,o.z*2-.2,1.15);frame.holes.push(roundedRect(f.x*2,f.z*2,.5,0,0,new THREE.Path()));
    this.add(this.extrude(frame,.34,.1,6),wood,[0,1.98,0],true);
    this.add(this.extrude(roundedRect(f.x*2+.3,f.z*2+.3,.6),.05,0),felt,[0,2.04,0]);
    this.add(this.extrude(roundedRect(o.x*2-.6,o.z*2-.6,1),.66,.05,3),darkWood,[0,1.2,0]);
    for(const x of [-5.2,5.2])for(const z of [-3.2,3.2])this.add(turned(new THREE.CylinderGeometry(.26,.34,1.2,24),.3,1.2),darkWood,[x,.6,z],true);
  }
  buildRacks() {
    const {wood,darkWood}=this.materials;this.racks=new Map();
    for(const [seat,{x,z,yaw}] of Object.entries(RACKS)) {
      const rack=new THREE.Group();rack.position.set(x,TABLE.frameTop,z);rack.rotation.y=yaw;this.group.add(rack);
      const piece=(geometry,material,position)=>{const m=new THREE.Mesh(this.own(geometry),material);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;rack.add(m);return m;};
      piece(roundedSlab(4.6,.1,.74,.06,.022,3),darkWood,[0,.05,0]);
      piece(roundedSlab(4.6,.24,.1,.035,.02,3),wood,[0,.14,-.36]);
      for(const side of [-1,1]){const cap=piece(turned(new THREE.CylinderGeometry(.13,.13,.74,20),.13,.74),wood,[side*2.33,.13,0]);cap.rotation.x=Math.PI/2;}
      const shadow=new THREE.Mesh(this.own(new THREE.PlaneGeometry(5,1.05).rotateX(-Math.PI/2)),this.materials.rackShadow);shadow.position.y=.004;shadow.renderOrder=-1;rack.add(shadow);
      const backs=[];
      if(Number(seat)>0)for(let i=0;i<7;i++){
        // Each tile leans toward the centre with its reverse facing up: no face geometry exists.
        const t=this.tiles.reverse(rack);t.quaternion.setFromEuler(new THREE.Euler(-TILT,0,0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,Math.PI/2)));
        t.position.set(0,.1+TILE.length/2*Math.cos(TILT)+TILE.height/2*Math.sin(TILT),-.04);backs.push(t);
      }
      this.racks.set(Number(seat),{group:rack,backs});
    }
  }
  buildFlag() {
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;
    const texture=this.own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f4f1ea';ctx.fillRect(0,0,900,600);
    const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,900,600);texture.needsUpdate=true;this.onChange?.();};image.src=FLAG_URL;
    const plaque=new THREE.PlaneGeometry(1.08,.72);plaque.rotateX(-Math.PI/2);
    // Off-centre on the front rail so the player's hand, centred at the bottom, never covers it.
    this.add(roundedSlab(1.2,.03,.84,.06,.01,2),this.materials.brass,[TABLE.flagX,TABLE.frameTop+.004,4.18]);
    // Printed enamel: matte enough that the flag never glares.
    this.add(plaque,this.own(new THREE.MeshStandardMaterial({map:texture,roughness:.7})),[TABLE.flagX,TABLE.frameTop+.021,4.18]);
  }
  buildTricolour() {
    const {red,white,blue}=this.materials,o=TABLE.outerHalf;
    // Front face bands either side of the centre, like the reference.
    for(const side of [-1,1])[[blue,2.25],[white,2.2],[red,2.15]].forEach(([m,y])=>this.add(new THREE.BoxGeometry(4.1,.045,.012),m,[side*3.25,y,o.z+.003]));
    // Thin inlaid arcs over each rounded corner of the rail.
    const r=1.15,cx=o.x-.1-r,cz=o.z-.1-r;
    for(const [sx,sz] of [[1,1],[-1,1],[1,-1],[-1,-1]])[[blue,.62],[white,.69],[red,.76]].forEach(([m,radius])=>{
      const points=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI/2;points.push(new THREE.Vector3(sx*(cx+Math.cos(a)*radius),TABLE.frameTop+.012,sz*(cz+Math.sin(a)*radius)));}
      this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.022,5,false),m);
    });
  }
  // Baked soft occlusion: under the table on the floor (racks carry their own). Visible on every quality
  // level, so objects keep their weight even where real-time shadows are off.
  buildContactShadows() {
    const floor=new THREE.Mesh(this.own(new THREE.PlaneGeometry(16.5,12.4).rotateX(-Math.PI/2)),this.materials.shadow);floor.position.y=.045;floor.renderOrder=-1;this.group.add(floor);
    const f=TABLE.feltHalf,edge=new THREE.Mesh(this.own(new THREE.PlaneGeometry(f.x*2,f.z*2).rotateX(-Math.PI/2)),this.materials.feltEdge);edge.position.y=TABLE.feltTop+.003;edge.renderOrder=-1;this.group.add(edge);
  }
  setCounts(counts){for(const [seat,{backs}] of this.racks)backs.forEach((b,i)=>{b.visible=i<counts[seat];b.position.x=(i-(counts[seat]-1)/2)*.6;});}
  rackPoint(seat){const r=RACKS[seat];return new THREE.Vector3(r.x,TABLE.frameTop+.4,r.z);}
  labelAnchors(){return Object.entries(LABELS).map(([seat,[x,z]])=>({seat:Number(seat),point:new THREE.Vector3(x,TABLE.frameTop+.05,z)}));}
  dispose(){for(const r of this.disposables){if(r.map&&!this.disposables.includes(r.map))r.map.dispose();r.dispose();}}
}

// Cylinder UVs in table units with the grain running along its length.
function turned(geometry,radius,length) {
  const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,v*length,u*Math.PI*2*radius);}
  return geometry;
}
