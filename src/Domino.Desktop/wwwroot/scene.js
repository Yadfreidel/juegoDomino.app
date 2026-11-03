import {ChaosEffects} from './chaos-effects.js';
import * as THREE from './vendor/three.module.js';
import {TILE,layoutChain,tilePose,previewTile,footprint} from './chain-layout.js';
import {TableCamera} from './camera-controller.js';
import {TilePresenter} from './tile-presenter.js';
import {DominoTableModel,TABLE,TABLE_LAYOUTS} from './table-model.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {TableLighting} from './lighting.js';
import {TableProps} from './table-props.js';
import {SurfaceTextures,createTableMaterials,disposeMaterials,setClearcoat} from './materials.js';
import {qualityProfile} from './graphics-quality.js';
import {LAUNCH_STYLES,launchFrame,launchStyle} from './launch-styles.js';
export {pipPattern} from './chain-layout.js';

// Orchestrates rendering only: rules, legality and scores always come from the server snapshot.
export class PatioScene {
  constructor(canvas) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2('#b5958d',.006);
    // Near plane well in front of the closest camera pose: more depth precision, no flicker on thin layers.
    this.camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.3,220);
    this.view=new TableCamera(this.camera,canvas,{outline:TABLE.outline,playArea:TABLE.playArea,surfaceY:TABLE.feltTop,topY:TABLE.frameTop,felt:TABLE.feltHalf});
    this.dynamic=new THREE.Group();this.scene.add(this.dynamic);
    this.overhead=new THREE.Group();this.scene.add(this.overhead);
    this.unitBox=new THREE.BoxGeometry(1,1,1);this.sphere=new THREE.SphereGeometry(1,20,14);
    this.wood=this.mat('#582f1c',{map:this.texture('wood'),roughness:.36});
    this.darkWood=this.mat('#32190f',{map:this.texture('wood'),roughness:.4});
    this.gold=this.mat('#b68b45',{metalness:.72,roughness:.27});
    this.stone=this.mat('#b7a18b',{map:this.texture('stone'),roughness:1});this.leaf=this.mat('#244d2d',{roughness:.9,side:THREE.DoubleSide});
    this.lighting=new TableLighting(this.renderer,this.scene);
    this.buildSky();this.buildTerrace();this.buildCourtyard();this.batchEnvironment();
    // Everything built so far is the open-air scenery; the club room is the alternative backdrop.
    this.outdoor=new THREE.Group();for(const child of [...this.scene.children])if(child!==this.dynamic&&child!==this.lighting.group)this.outdoor.add(child);this.scene.add(this.outdoor);
    this.buildClub();
    // Scenery colours, kept so the night patio can dim them while the bulbs stay bright.
    this.scenery=new Map();this.outdoor.traverse(o=>{for(const m of [o.material].flat())if(m?.color&&!m.isMeshBasicMaterial&&!m.isShaderMaterial&&!this.scenery.has(m))this.scenery.set(m,m.color.clone());});
    this.tiles=new TilePresenter();this.surfaces=new SurfaceTextures();this.tableMaterials=createTableMaterials(this.surfaces);
    // One table per orientation, built once. Switching only changes which one is shown and how the chain is laid out.
    this.tables={};for(const [name,layout] of Object.entries(TABLE_LAYOUTS)){const table=new DominoTableModel(this.tiles,this.tableMaterials,layout);table.group.visible=false;this.tables[name]=table;this.scene.add(table.group);}
    this.orientation=null;this.table=this.tables.landscape;
    // Drinks on the rail corners for the neighbourhood table; shared geometry, one group per table shape.
    this.props=new TableProps();for(const table of Object.values(this.tables)){table.props=this.props.create(table.layout);table.group.add(table.props);}
    const {coated,...surfaces}=this.tableMaterials,tileMaterials=this.tiles.materials;
    this.lighting.reflect([...Object.values(surfaces),...tileMaterials.ivory,tileMaterials.ink,tileMaterials.back,tileMaterials.ghostIvory,tileMaterials.ghostInk,...this.props.allMaterials()]);
    // Seen from above, the varnish would mirror the bright room ceiling and wash the mahogany out.
    for(const m of coated)m.envMapIntensity=.28;
    for(const table of Object.values(this.tables))table.onChange=()=>{this.renderer.shadowMap.needsUpdate=true;};
    this.tileNodes=new Map();this.motion=[];
    this.ghosts={left:this.tiles.face(0,0,this.dynamic,true),right:this.tiles.face(0,0,this.dynamic,true)};
    this.dragTile=this.tiles.face(0,0,this.dynamic,true);this.dragTile.visible=false;this.dragTarget=new THREE.Vector3();this.dragActive=false;
    for(const g of [this.ghosts.left,this.ghosts.right])g.visible=false;
    this.endPoints=[];this.resizeHandler=()=>this.resize();this.resize();window.addEventListener('resize',this.resizeHandler);
    this.last=0;this.frame=0;this.onFrame=null;this.isPlacing=false;this.performanceSamples=[];this.time=0;this.motionUntil=0;
    this.profile=qualityProfile('medium',devicePixelRatio,this.renderer.capabilities.getMaxAnisotropy());
    this.chaosCameraPose=new THREE.Vector3();this.chaos=new ChaosEffects(this);
    this.renderer.setAnimationLoop(t=>this.animate(t));
  }
  mat(color,props={}) {return new THREE.MeshStandardMaterial({color,...props});}
  texture(kind,repeat) {
    const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
    let seed=29;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    if(kind==='wood') {
      ctx.fillStyle='#c9ab8a';ctx.fillRect(0,0,512,512);
      for(let i=0;i<720;i++){const y=rand()*512;ctx.strokeStyle=`rgba(${rand()>.4?'49,25,10':'246,207,150'},${rand()*.15})`;ctx.lineWidth=rand()*2+.3;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=512;x+=16)ctx.lineTo(x,y+Math.sin(x*.012+y)*3+Math.sin(x*.04+y)*.7);ctx.stroke();}
    } else {
      ctx.fillStyle='#c8bba6';ctx.fillRect(0,0,512,512);
      for(let i=0;i<5500;i++){ctx.fillStyle=`rgba(70,51,35,${rand()*.15})`;ctx.fillRect(rand()*512,rand()*512,rand()*8,rand()*4);}
      ctx.strokeStyle='#918875';ctx.lineWidth=3;for(let y=0;y<512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let x=(y/128%2)*128;x<512;x+=256){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+128);ctx.stroke();}}
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
    const r=repeat??(kind==='stone'?8:1);t.repeat.set(r,r);t.anisotropy=4;return t;
  }
  mesh(geo,mat,pos,scale,parent=this.scene) {const m=new THREE.Mesh(geo,mat);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=false;m.receiveShadow=true;parent.add(m);return m;}
  box(mat,pos,scale,parent){return this.mesh(this.unitBox,mat,pos,scale,parent);}
  ball(mat,pos,scale,parent){return this.mesh(this.sphere,mat,pos,scale,parent);}
  cylinder(mat,top,bottom,h,pos,parent=this.scene) {return this.mesh(new THREE.CylinderGeometry(top,bottom,h,20),mat,pos,null,parent);}
  segment(a,b,r,mat,parent=this.scene) {const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);const m=this.mesh(new THREE.CylinderGeometry(r,r,v.length(),12),mat,start.clone().add(end).multiplyScalar(.5).toArray(),null,parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
  buildSky() {
    const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vP; void main(){vec3 d=normalize(vP);float h=d.y;vec3 horizon=vec3(.96,.59,.37),top=vec3(.27,.32,.53);vec3 c=mix(horizon,top,smoothstep(-.01,.6,h));float clouds=sin(d.x*34.+d.z*15.)*sin(d.z*53.-d.x*22.)*.5+.5;c=mix(c,vec3(.56,.39,.48),smoothstep(.52,.85,clouds)*smoothstep(.01,.18,h)*(1.-smoothstep(.35,.6,h))*.55);float sun=pow(max(0.,dot(d,normalize(vec3(-.35,.10,-1.)))),4000.);c+=vec3(1.,.7,.36)*sun;gl_FragColor=vec4(c,1.);}`});
    this.sky=this.mesh(new THREE.SphereGeometry(150,32,24),skyMat,[0,0,0]);
    const oceanMat=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform float time; varying vec2 vUv;void main(){float waves=sin(vUv.y*1500.+sin(vUv.x*150.+time)*2.+time*5.)*.5+.5;float reflection=exp(-pow((vUv.x-.38)*15.,2.))*(.3+waves*.7);vec3 c=mix(vec3(.09,.23,.29),vec3(.23,.32,.39),vUv.y);c+=vec3(.6,.24,.07)*reflection*.5;c+=waves*.025;gl_FragColor=vec4(c,1.);}`});
    this.ocean=this.mesh(new THREE.PlaneGeometry(240,190),oceanMat,[0,-.9,-65]);this.ocean.rotation.x=-Math.PI/2;this.ocean.receiveShadow=false;this.ocean.castShadow=false;
    const coast=this.mat('#62525b');for(let i=0;i<17;i++){this.box(coast,[30+i*3,-.2,-60+Math.sin(i)*3],[4,2+Math.sin(i*2),4]);}
  }
  buildTerrace() {
    this.box(this.stone,[0,-.15,0],[32,.35,25]);
    for(const x of [-10.5,10.5]) {
      this.box(this.stone,[x,3.3,-5.3],[1.05,7,1.05]);this.box(this.stone,[x,6.65,-5.3],[1.4,.35,1.4]);this.box(this.stone,[x,.2,-5.3],[1.4,.6,1.4]);
      this.lantern(x,4,-4.65);
    }
    this.box(this.darkWood,[0,7,-5.3],[22,.38,.55],this.overhead);
    for(let i=-4;i<=4;i++)this.box(this.darkWood,[i*2.6,7.1,0],[.22,.35,13],this.overhead);
    for(let i=-6;i<=6;i++) {this.cylinder(this.stone,.07,.07,1.8,[i*1.6,.9,-8]);}
    this.box(this.wood,[0,1.9,-8],[21,.15,.22]);
    for(const z of [-4,-1,2]){const points=[];for(let i=0;i<=40;i++){let x=-10.3+i*.515;points.push(new THREE.Vector3(x,6.9-Math.sin(i/40*Math.PI)*.9,z));}const curve=new THREE.CatmullRomCurve3(points);this.mesh(new THREE.TubeGeometry(curve,40,.016,5,false),this.darkWood,null,null,this.overhead);for(let i=1;i<13;i++){let t=i/13,p=curve.getPoint(t);this.segment(p.toArray(),[p.x,p.y-.18,p.z],.012,this.darkWood,this.overhead);const bulb=this.ball(new THREE.MeshBasicMaterial({color:'#ffe0a0'}),[p.x,p.y-.23,p.z],[.065,.09,.065],this.overhead);bulb.castShadow=false;}}
    for(const [x,z,s] of [[-13,-9,1.2],[-7.8,-13,.9],[11,-13,1.1],[18,-17,1.4],[-18,-17,1.4],[6.6,-19,.9]])this.palm(x,z,s);
    for(const x of [-8.4,8.4]) {
      this.cylinder(this.mat('#593f29'),.62,.43,1.05,[x,.45,-5.9]);
      for(let i=0;i<9;i++){let angle=i*Math.PI*2/9;this.leaves(x,.85,-5.9,angle,1.7,1.6);}
    }
    // A restrained Dominican flag on a coastal fort, modeled from original geometry.
    const fortStart=this.scene.children.length;
    const fort=this.mat('#8b7967');this.box(fort,[18,.8,-33],[7,4,5]);this.cylinder(fort,2.1,2.5,6,[14.8,1.5,-32]);for(let i=0;i<5;i++)this.box(fort,[15+i*1.3,3.1,-30.5],[.6,.7,.65]);
    this.cylinder(this.gold,.035,.035,7,[18,6,-33]);
    const white=this.mat('#f6f0df'),blue=this.mat('#254970'),red=this.mat('#ac3c3d');
    this.box(white,[19,8.5,-33],[2.1,1.2,.035]);for(let a=0;a<2;a++)for(let b=0;b<2;b++)this.box((a+b)%2?red:blue,[18.45+a*1.05,8.2+b*.6,-32.97],[.88,.45,.025]);
    this.fortGroup=new THREE.Group();for(const o of this.scene.children.slice(fortStart))this.fortGroup.add(o);this.scene.add(this.fortGroup);
  }
  buildCourtyard() {
    this.courtyard=new THREE.Group();this.scene.add(this.courtyard);const wall=this.mat('#c0a780',{roughness:1}),clay=this.mat('#864b36');
    this.box(wall,[0,1.6,-10.2],[28,3.4,.4],this.courtyard);
    for(const x of [-11,11]){this.box(wall,[x,2.2,-7],[3,4.5,4.5],this.courtyard);const roof=this.box(clay,[x,4.6,-7],[3.6,.2,5.1],this.courtyard);roof.rotation.z=x>0?-.12:.12;this.box(this.darkWood,[x,2.7,-4.72],[1.1,1.3,.08],this.courtyard);}
    for(const x of [3,6])this.lantern(x,2.7,-9.85,.6);
    this.buildColmado();this.courtyard.visible=false;
  }
  // Night patio of a corner store: painted facade with its sign, the flag on the wall, white plastic chairs
  // and warm bulbs strung across. Original low-poly geometry; it stays dim so the table is the protagonist.
  buildColmado() {
    const g=this.courtyard,paint=this.mat('#c99a35',{roughness:.95}),blue=this.mat('#1d4f8f',{roughness:.8}),dark=this.mat('#160d08',{roughness:1}),plastic=this.mat('#ecebe6',{roughness:.55});
    this.box(paint,[-5.4,2.3,-9.9],[7.4,4.6,.3],g);this.box(blue,[-5.4,4.75,-9.55],[7.8,.35,1.1],g);
    this.box(dark,[-6.6,1.35,-9.72],[2,2.7,.05],g);
    const goods=['#c0392b','#f1c40f','#2e86c1','#27ae60','#e67e22','#ecf0f1','#8e44ad','#d35400'];
    for(let i=0;i<16;i++)this.box(this.mat(goods[i%goods.length],{roughness:.7}),[-7.35+(i%8)*.21,.75+Math.floor(i/8)*.75,-9.68],[.17,.42,.08],g);
    this.box(this.mat('#5b3a22',{roughness:.9}),[-6.6,1.05,-9.66],[1.9,.05,.18],g);this.box(this.mat('#5b3a22',{roughness:.9}),[-6.6,1.8,-9.66],[1.9,.05,.18],g);
    const sign=this.canvasPlane(1024,256,ctx=>{ctx.fillStyle='#f3d27a';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#b8231f';ctx.font='italic 900 120px Georgia,serif';ctx.textAlign='center';ctx.fillText('Colmado',512,128);ctx.font='italic 700 76px Georgia,serif';ctx.fillStyle='#1d4f8f';ctx.fillText('La Esquina',512,214);});
    sign.position.set(-4.3,3.55,-9.72);sign.scale.set(3.6,.9,1);g.add(sign);
    const flag=this.canvasPlane(900,600,(ctx,texture)=>{ctx.fillStyle='#f4f1ea';ctx.fillRect(0,0,900,600);const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,900,600);texture.needsUpdate=true;};img.src='assets/bandera-republica-dominicana.svg';});
    flag.position.set(1.4,3,-9.97);flag.scale.set(2.1,1.4,1);g.add(flag);
    for(const [x,z,r] of [[-7.6,-6.4,.5],[7.9,-6.8,-.6],[-3.1,-8.5,.1],[4.6,-8.7,-.15],[-9.2,-3.6,1.2]])this.chair(x,z,r,plastic,g);
    this.box(plastic,[-6.2,1.4,-8.2],[1.5,.06,1.5],g);this.cylinder(plastic,.07,.07,1.4,[-6.2,.7,-8.2],g);
    // Warm bulbs on a sagging wire across the patio.
    const bulb=new THREE.MeshBasicMaterial({color:'#ffd27a'});
    for(const [z,y] of [[-8.6,5.4],[-5.2,5.9]]){
      const points=[];for(let i=0;i<=24;i++){const x=-11+i*22/24;points.push(new THREE.Vector3(x,y-Math.sin(i/24*Math.PI)*.8,z));}
      const curve=new THREE.CatmullRomCurve3(points);this.mesh(new THREE.TubeGeometry(curve,48,.012,4,false),dark,null,null,g);
      for(let i=1;i<16;i++){const p=curve.getPoint(i/16);this.ball(bulb,[p.x,p.y-.14,p.z],[.08,.1,.08],g).castShadow=false;}
    }
  }
  canvasPlane(w,h,draw) {
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    draw(canvas.getContext('2d'),texture);texture.needsUpdate=true;return new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));
  }
  chair(x,z,rotation,material,parent) {
    const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=rotation;parent.add(c);
    this.box(material,[0,.92,0],[.95,.08,.9],c);const back=this.box(material,[0,1.45,-.44],[.95,1,.07],c);back.rotation.x=-.12;
    for(const [lx,lz] of [[-.4,-.38],[.4,-.38],[-.4,.38],[.4,.38]])this.cylinder(material,.045,.06,.92,[lx,.46,lz],c);
  }
  // Dark tournament room: night-blue walls, thin blue and red light strips far away, a soft rug under the table.
  buildClub() {
    const g=new THREE.Group();this.club=g;this.scene.add(g);
    const wall=this.mat('#0b1428',{roughness:.95}),floor=this.mat('#0a1121',{roughness:.6,metalness:.05}),rug=this.mat('#111d3a',{roughness:1});
    const room=this.mesh(new THREE.BoxGeometry(70,26,70),new THREE.MeshStandardMaterial({color:'#0b1428',roughness:1,side:THREE.BackSide}),[0,13,0],null,g);room.receiveShadow=false;
    const ground=this.mesh(new THREE.PlaneGeometry(70,70),floor,[0,0,0],null,g);ground.rotation.x=-Math.PI/2;
    const mat=this.mesh(new THREE.CircleGeometry(12.5,48),rug,[0,.012,0],null,g);mat.rotation.x=-Math.PI/2;
    const blue=new THREE.MeshBasicMaterial({color:'#3a74ff'}),red=new THREE.MeshBasicMaterial({color:'#ff2d46'});
    for(const [m,y,x] of [[blue,7.2,-7],[red,7.2,7],[blue,3.1,-10],[red,3.1,10]])this.box(m,[x,y,-30],[16,.12,.12],g);
    for(const [m,x] of [[blue,-30],[red,30]])for(const z of [-18,-6,6])this.box(m,[x,5.5,z],[.12,7,.12],g);
    this.box(wall,[0,1.2,-29.6],[60,2.4,.4],g);
    g.visible=false;
  }
  setEnvironment(name) {
    const club=name==='club';this.club.visible=club;this.outdoor.visible=!club;
    const barrio=name==='courtyard';this.courtyard.visible=barrio;this.ocean.visible=name==='terrace';this.fortGroup.visible=name==='terrace';this.sky.visible=!barrio;
    // The neighbourhood plays at night: dark warm background, fog that softens the patio, green felt, drinks.
    this.scene.background=club?new THREE.Color('#070d1b'):barrio?new THREE.Color('#0d0806'):null;
    this.scene.fog.color.set(club?'#070d1b':barrio?'#0d0806':'#b5958d');this.scene.fog.density=club?.016:barrio?.011:.006;
    for(const [m,base] of this.scenery)m.color.copy(base).multiplyScalar(barrio?.32:1);
    this.tableMaterials.felt.color.set(club?'#24418c':'#1d5a33');
    for(const table of Object.values(this.tables))table.props.visible=barrio;
    this.lighting.setMood(club?'club':barrio?'barrio':'outdoor');
  }
  lantern(x,y,z,s=1) {
    const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);this.scene.add(g);
    this.box(this.darkWood,[0,0,0],[.36,.55,.35],g);this.box(new THREE.MeshBasicMaterial({color:'#ffbf63'}),[0,0,.185],[.25,.4,.015],g);
    for(const dx of [-.14,.14])this.box(this.gold,[dx,0,.2],[.025,.48,.025],g);this.box(this.gold,[0,0,.2],[.3,.025,.025],g);
    this.mesh(new THREE.ConeGeometry(.32,.22,4),this.darkWood,[0,.37,0],null,g);
  }
  leaves(x,y,z,angle,length,droop,parent=this.scene) {
    const positions=[],indices=[];
    for(let i=0;i<=12;i++){const t=i/12;const width=Math.sin(t*Math.PI)*length*.13;const r=t*length;const cy=y+Math.sin(t*Math.PI)*.32-t*t*droop;for(const side of [-1,1])positions.push(x+Math.cos(angle)*r-Math.sin(angle)*width*side,cy,z+Math.sin(angle)*r+Math.cos(angle)*width*side);if(i<12){let a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();this.mesh(g,this.leaf,null,null,parent);
  }
  palm(x,z,s) {
    const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(s);this.scene.add(group);
    let px=0,py=0,pz=0;for(let i=0;i<9;i++){let nx=Math.sin(i*.12)*.7,ny=(i+1)*.74,nz=.03*i*i;this.segment([px,py,pz],[nx,ny,nz],.19-i*.009,this.wood,group);px=nx;py=ny;pz=nz;}
    for(let i=0;i<11;i++)this.leaves(px,py,pz,i*Math.PI*2/11,3.2+(i%3)*.35,1.2,group);
  }
  batchEnvironment() {
    const protectedGroups=new Set([this.courtyard,this.fortGroup,this.overhead]),preserveGeometry=new Set([this.unitBox,this.sphere]);
    this.scene.updateMatrixWorld(true);
    for(const root of [this.scene,...protectedGroups]) {
      const batches=new Map(),inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
      const collect=node=>{if(node!==root&&protectedGroups.has(node))return;if(node.isMesh&&!node.material.isShaderMaterial){const key=node.material.id+':'+Object.keys(node.geometry.attributes).sort().join(',')+':'+!!node.geometry.index;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(node);}for(const child of node.children)collect(child);};collect(root);
      for(const nodes of batches.values()) {
        if(nodes.length<2)continue;
        const geometries=nodes.map(node=>node.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld)));
        const merged=mergeGeometries(geometries,false);for(const geometry of geometries)geometry.dispose();if(!merged)continue;
        const batch=new THREE.Mesh(merged,nodes[0].material);batch.receiveShadow=true;root.add(batch);
        const originals=new Set();for(const node of nodes){originals.add(node.geometry);node.removeFromParent();}
        for(const geometry of originals)if(!preserveGeometry.has(geometry))geometry.dispose();
      }
    }
  }
  update(state) {
    this.chaos?.cancel();
    const previous=this.state;if(previous?.handNumber!==state.handNumber||!state.accepted)this.chaos&&(this.chaos.frozen=false);this.state=state;this.layoutData=layoutChain(state.chain,this.orientation);
    this.setEnvironment(state.settings?.environment??'courtyard');
    const visible=new Set(),oldKeys=new Set((previous?.chain??[]).map(t=>`${Math.min(t.left,t.right)}:${Math.max(t.left,t.right)}`));
    let played=false,launched=null;this.motion=[];
    state.chain.forEach((t,i)=>{
      const key=`${Math.min(t.left,t.right)}:${Math.max(t.left,t.right)}`;visible.add(key);
      let node=this.tileNodes.get(key);if(!node){node=this.tiles.face(t.left,t.right,this.dynamic);this.tileNodes.set(key,node);}
      this.tiles.setFace(node,t.left,t.right);node.visible=true;
      const p=this.layoutData.placements[i],target=new THREE.Vector3(p.x,p.y,p.z);
      const fresh=previous&&state.handNumber===previous.handNumber&&!oldKeys.has(key)&&state.chain.length>previous.chain.length;
      let from=node.position.clone();
      if(!previous||previous.handNumber!==state.handNumber){from.copy(target);node.position.copy(target);}
      // The accepted tile travels in from its owner's side; the authority already applied the move.
      // My moves use my chosen launch style, the bots' a soft one. The end pose is always the layout's.
      let style=null;
      if(fresh){played=true;style=previous.turn===0?launchStyle(this.launchStyle):'suave';from=this.table.rackPoint(previous.turn);
        if(style==='deslizar'){const f=this.table.layout.feltHalf;from.set(target.x*.4,TILE.y+.03,previous.turn===0?f.z-.35:from.z);}
        launched={style,seat:previous.turn};this.lastLaunch=style;}
      const duration=this.reducedMotion?.1:style?LAUNCH_STYLES[style].duration:.28;this.motionUntil=Math.max(this.motionUntil,this.time+duration);
      this.motion.push({node,from,target,fromAngle:fresh?p.angle:node.rotation.y,angle:p.angle,start:this.time,duration,fresh,style});
    });
    for(const [key,node] of this.tileNodes)if(!visible.has(key))node.visible=false;
    for(const table of Object.values(this.tables))table.setCounts(state.counts);
    this.view.setChainBounds(this.chainBounds());
    if(played){this.isPlacing=true;this.placingUntil=this.time+(this.reducedMotion?.1:LAUNCH_STYLES[launched.style].duration)+.04;this.onLaunch?.(launched);}
    this.renderer.shadowMap.needsUpdate=true;this.preview(state,null,[],null);
  }
  chainBounds() {
    const boxes=[...this.layoutData.placements,this.layoutData.destinations.left,this.layoutData.destinations.right].map(p=>footprint({...p,angle:p.angle??p.heading}));
    return {minX:Math.min(...boxes.map(b=>b.x-b.halfX)),maxX:Math.max(...boxes.map(b=>b.x+b.halfX)),minZ:Math.min(...boxes.map(b=>b.z-b.halfZ)),maxZ:Math.max(...boxes.map(b=>b.z+b.halfZ))};
  }
  preview(state,tile,ends,chosen) {
    this.endPoints=[];
    for(const end of ['left','right']) {
      const node=this.ghosts[end];node.visible=!!tile&&ends.includes(end)&&!this.isPlacing;
      if(!node.visible)continue;
      const oriented=previewTile(state.chain,tile,end),pose=tilePose(this.layoutData.destinations[end],oriented);
      this.tiles.setFace(node,oriented.left,oriented.right);node.position.set(pose.x,pose.y+.022,pose.z);node.rotation.y=pose.angle;
      this.endPoints.push({end,point:node.position.clone(),angle:pose.angle});
    }
    this.chosen=chosen;
  }
  hitDestination(x,y,radius=64) {
    if(this.isPlacing)return null;
    const pinned=this.markerHit?.(x,y);if(pinned&&this.endPoints.some(e=>e.end===pinned))return pinned;
    if(!this.view.tablePoint(x,y))return null;
    let best=null,distance=radius;
    for(const {end,point} of this.endPoints){const p=this.project(point),d=Math.hypot(x-p.x,y-p.y);if(p.visible&&d<distance){best=end;distance=d;}}
    return best;
  }
  moveDrag(x,y,tile,end) {
    if(!tile)return;const p=this.view.tablePoint(x,y);if(!p)return;
    const destination=this.endPoints.find(e=>e.end===end);
    if(destination)this.dragTarget.copy(destination.point);else this.dragTarget.copy(p);
    this.dragTarget.y=TILE.y+.13;
    const oriented=previewTile(this.state.chain,tile,end??'right');this.tiles.setFace(this.dragTile,oriented.left,oriented.right);
    this.dragTile.rotation.y=destination?.angle??0;
    if(!this.dragActive)this.dragTile.position.copy(this.dragTarget);
    this.dragActive=true;this.dragTile.visible=true;
  }
  clearDrag(){this.dragActive=false;this.dragTile.visible=false;}
  // After a hidden tab or an interruption: jump every tile to the pose of the real state, never mid-flight.
  finishMotion() {
    for(const m of this.motion){m.node.position.copy(m.target);m.node.rotation.y=m.angle;}
    this.motion=[];this.motionUntil=this.time;if(this.isPlacing){this.isPlacing=false;this.onSettled?.();}this.renderer.shadowMap.needsUpdate=true;
  }
  project(point){return this.view.project(point);}
  playerAnchors(){return this.table.labelAnchors();}
  animate(t) {
    const interval=document.body.classList.contains('outside-game')?200:1000/this.profile.fps;
    if(this.last&&t-this.last<interval-1)return;
    const elapsed=this.last?t-this.last:16.67,dt=Math.min(elapsed/1000,.1);this.last=t;this.time=t*.001;this.frame++;
    if(this.performanceSamples.length<900)this.performanceSamples.push(elapsed);
    this.view.update(dt);this.overhead.visible=this.camera.position.y<6.6;
    if(this.ocean&&!this.reducedMotion)this.ocean.material.uniforms.time.value=t*.00015;
    for(const m of this.motion) {
      const progress=Math.min(1,Math.max(0,(this.time-m.start)/m.duration));
      const k=m.style&&!this.reducedMotion?launchFrame(m.style,progress):{f:progress*progress*(3-2*progress),lift:0,turn:0};
      m.node.position.lerpVectors(m.from,m.target,k.f);m.node.position.y+=k.lift;m.node.rotation.y=m.fromAngle+(m.angle-m.fromAngle)*k.f+k.turn;
    }
    if(this.dragActive)this.dragTile.position.lerp(this.dragTarget,1-Math.exp(-dt*22));
    if(this.isPlacing&&this.time>=this.placingUntil){this.isPlacing=false;this.onSettled?.();}
    // Shadows are static between moves: refresh them only while something moves.
    if(this.profile.shadows&&(this.dragActive||this.chaosBusy||this.time<this.motionUntil+.05))this.renderer.shadowMap.needsUpdate=true;
    this.chaos?.update();
    const cameraPose=this.chaosCameraPose.copy(this.camera.position);
    if(this.chaosBusy&&!this.reducedMotion&&this.chaosCameraMotion!==false&&['slam','trancazo','meteor'].includes(this.chaos.event?.power)){
      const age=this.time-this.chaos.start,shake=Math.max(0,1-age*2)*.045;this.camera.position.x+=Math.sin(age*35)*shake;this.camera.position.y+=Math.sin(age*27)*shake;
    }
    this.renderer.render(this.scene,this.camera);this.camera.position.copy(cameraPose);this.onFrame?.();
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight);this.view.resize();this.applyOrientation(innerHeight>innerWidth?'portrait':'landscape');this.onFrame?.();}
  // Presentation only: same snapshot, same tiles and turn; the chain glides to its new layout.
  applyOrientation(name) {
    if(name===this.orientation)return;this.orientation=name;
    for(const [key,table] of Object.entries(this.tables))table.group.visible=key===name;
    this.table=this.tables[name];this.view.setTable(this.table.layout);this.renderer.shadowMap.needsUpdate=true;
    if(this.state){this.update(this.state);this.onLayout?.();}
  }
  quality(value) {
    const profile=qualityProfile(value,devicePixelRatio,this.renderer.capabilities.getMaxAnisotropy());this.profile=profile;this.qualityLevel=profile.name;
    this.renderer.setPixelRatio(profile.pixelRatio);this.lighting.applyQuality(profile);this.surfaces.setAnisotropy(profile.anisotropy);
    setClearcoat(this.tableMaterials.coated,profile.clearcoat);this.tiles.applyQuality(profile);this.resize();
  }
  metrics() {
    const sorted=[...this.performanceSamples].sort((a,b)=>a-b),mean=sorted.reduce((a,b)=>a+b,0)/Math.max(1,sorted.length);
    // Face paint (pips and centre line) inside the racks would reveal a hidden hand; it must stay 0.
    let faces=0;for(const table of Object.values(this.tables))table.group.traverse(o=>{if(o.userData.face)faces++;});
    return {chaosActive:this.chaosBusy??false,chaosPower:this.chaos?.event?.power??null,samples:sorted.length,meanFrameMs:mean,p95FrameMs:sorted[Math.floor(sorted.length*.95)]??0,approxFps:1000/mean,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,viewport:[innerWidth,innerHeight],orientation:this.orientation,quality:this.qualityLevel,pixelRatio:this.renderer.getPixelRatio(),shadows:this.renderer.shadowMap.enabled,
      camera:{yaw:this.view.yaw,tilt:this.view.tilt,zoom:this.view.zoom,inspecting:this.view.inspecting,position:this.camera.position.toArray()},opponentFaces:faces,pooledTiles:this.tileNodes.size,
      // Animation state, for tests: settled means every tile sits on the pose of the real state.
      settled:!this.isPlacing&&this.time>=this.motionUntil,lastLaunch:this.lastLaunch??null,environment:this.club.visible?'club':this.courtyard.visible?'courtyard':'terrace'};
  }
  dispose() {
    this.chaos?.dispose();
    this.renderer.setAnimationLoop(null);window.removeEventListener('resize',this.resizeHandler);
    for(const table of Object.values(this.tables))table.dispose();this.props.dispose();this.tiles.dispose();this.lighting.dispose();
    const {coated,...tableMaterials}=this.tableMaterials;disposeMaterials(Object.values(tableMaterials));this.surfaces.dispose();
    const geometries=new Set([this.unitBox,this.sphere]),materials=new Set(),textures=new Set(),skip=new Set([...Object.values(this.tables).map(t=>t.group),this.dynamic]);
    const walk=o=>{if(skip.has(o))return;if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);o.children.forEach(walk);};walk(this.scene);
    for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const tex of textures)tex.dispose();this.renderer.dispose();
  }
}
