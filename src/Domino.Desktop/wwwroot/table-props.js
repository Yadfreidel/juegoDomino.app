import * as THREE from './vendor/three.module.js';

// Drinks on the rail corners, outside the felt: rum on the rocks and a cold beer. Decoration only;
// geometry and materials are shared by every table and created once.
export class TableProps {
  constructor() {
    const lathe=(points,segments=28)=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),segments);
    this.geometry={
      // Thick-bottomed tumbler and a tall beer glass, open at the top.
      tumbler:lathe([[0,0],[.3,0],[.33,.02],[.34,.78],[.32,.78],[.31,.1],[0,.1]]),
      pint:lathe([[0,0],[.22,0],[.24,.02],[.31,1.22],[.29,1.22],[.21,.09],[0,.09]]),
      rum:new THREE.CylinderGeometry(.305,.3,.34,28),beer:new THREE.CylinderGeometry(.285,.215,1.0,28),foam:new THREE.CylinderGeometry(.295,.285,.12,28),
      ice:new THREE.BoxGeometry(.2,.18,.2),coaster:new THREE.CylinderGeometry(.44,.44,.025,32)
    };
    this.materials={
      glass:new THREE.MeshStandardMaterial({color:'#e9f2f5',transparent:true,opacity:.22,roughness:.06,metalness:0,depthWrite:false,side:THREE.DoubleSide}),
      rum:new THREE.MeshStandardMaterial({color:'#9b4a12',transparent:true,opacity:.86,roughness:.12}),
      beer:new THREE.MeshStandardMaterial({color:'#e3a21a',transparent:true,opacity:.88,roughness:.15,emissive:'#5a3300',emissiveIntensity:.25}),
      foam:new THREE.MeshStandardMaterial({color:'#fbf3df',roughness:.9}),
      ice:new THREE.MeshStandardMaterial({color:'#f2fbff',transparent:true,opacity:.6,roughness:.08}),
      coaster:new THREE.MeshStandardMaterial({color:'#2a1408',roughness:.8})
    };
  }
  // Corners of the rail: far left beer, far right and near left rum. The near right stays free for my rack side.
  create(layout) {
    const g=new THREE.Group(),f=layout.feltHalf,y=layout.frameTop,{geometry:G,materials:M}=this;
    const add=(geo,mat,x,yy,z,parent=g)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,yy,z);m.castShadow=mat!==M.glass&&mat!==M.ice;parent.add(m);return m;};
    const spot=(sx,sz)=>[sx*(f.x+.72),sz*(f.z+.72)];
    const rum=([x,z],seed)=>{
      add(G.coaster,M.coaster,x,y+.013,z);add(G.tumbler,M.glass,x,y+.026,z);add(G.rum,M.rum,x,y+.026+.1+.17,z);
      for(let i=0;i<3;i++){const a=seed+i*2.1,ice=add(G.ice,M.ice,x+Math.cos(a)*.12,y+.026+.36+i*.05,z+Math.sin(a)*.12);ice.rotation.set(a,a*1.7,a*.6);}
    };
    rum(spot(1,-1),.4);rum(spot(-1,1),1.3);
    const [bx,bz]=spot(-1,-1);add(G.coaster,M.coaster,bx,y+.013,bz);add(G.pint,M.glass,bx,y+.026,bz);add(G.beer,M.beer,bx,y+.026+.09+.5,bz);add(G.foam,M.foam,bx,y+.026+.09+1.04,bz);
    return g;
  }
  allMaterials(){return Object.values(this.materials);}
  dispose(){for(const g of Object.values(this.geometry))g.dispose();for(const m of Object.values(this.materials))m.dispose();}
}
