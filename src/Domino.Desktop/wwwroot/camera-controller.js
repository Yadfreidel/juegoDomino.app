import * as THREE from './vendor/three.module.js';

const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp,deg=THREE.MathUtils.degToRad;
// Overview: steepest tilt that still lets the table fill ~90 % of the usable width.
export const FRAMING=Object.freeze({widthShare:.9,steepest:deg(70),flattest:deg(27),fov:36});
// Small look-around from the player's side; inspection is a near top-down view that pans over the felt.
export const LOOK_LIMITS=Object.freeze({yaw:.14,tilt:.1,zoomIn:.6,zoomOut:1.08});
export const INSPECT_PITCH=deg(76);
// Minimum on-screen tile length in inspection, in pixels: long chains are panned, never shrunk below it.
export const TILE_PIXELS_MIN=88;

// Elevated table camera. It only ever looks down at the felt from the player's side,
// so rival racks are seen from behind (reverse faces only) at every allowed angle.
export class TableCamera {
  constructor(camera,canvas,{outline=[[-6,-4],[6,-4],[6,4],[-6,4]],playArea=null,surfaceY=2.09,topY=2.42,felt={x:5.4,z:3.3}}={}) {
    Object.assign(this,{camera,canvas,outline,surfaceY,topY,felt});this.playArea=playArea??outline.map(([x,z])=>[x,z,topY]);this.steepest=FRAMING.steepest;
    this.yaw=0;this.tilt=0;this.zoom=1;this.inspecting=false;this.sensitivity=1;this.invertY=false;this.reducedMotion=false;
    this.insets={top:0,bottom:0,left:0,right:0};this.getInsets=()=>this.insets;
    this.pan=new THREE.Vector3();this.chainBox={minX:-1,maxX:1,minZ:-.6,maxZ:.6};this.distance=20;
    this.position=new THREE.Vector3();this.target=new THREE.Vector3();this.desired={position:new THREE.Vector3(),target:new THREE.Vector3(),offsetX:0,offsetY:0};
    this.offsetX=0;this.offsetY=0;this.scratch=new THREE.Vector3();this.points=[];this.measureCamera=new THREE.PerspectiveCamera();
    this.raycaster=new THREE.Raycaster();this.floor=new THREE.Plane(new THREE.Vector3(0,1,0),-2.168);this.ndc=new THREE.Vector2();
    this.resize();this.update(1,true);
  }
  resize() {
    const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.left=r.left;this.top=r.top;
    this.camera.aspect=r.width/r.height;this.camera.fov=FRAMING.fov;this.camera.updateProjectionMatrix();this.dirty=true;
  }
  orbit(dx,dy) {
    if(this.inspecting){this.panBy(dx,dy);return;}
    this.yaw=clamp(this.yaw-dx*.0012*this.sensitivity,-LOOK_LIMITS.yaw,LOOK_LIMITS.yaw);
    this.tilt=clamp(this.tilt+dy*.001*this.sensitivity*(this.invertY?-1:1),-LOOK_LIMITS.tilt,LOOK_LIMITS.tilt);this.dirty=true;
  }
  // Drag moves the felt under the finger, limited to the playing surface.
  panBy(dx,dy) {
    const scale=this.distance*Math.tan(deg(FRAMING.fov/2))*2/this.height;
    this.pan.x=clamp(this.pan.x-dx*scale,-this.felt.x,this.felt.x);this.pan.z=clamp(this.pan.z-dy*scale/Math.sin(INSPECT_PITCH),-this.felt.z,this.felt.z);this.dirty=true;
  }
  dolly(delta){this.zoom=clamp(this.zoom*Math.exp(delta*.001),LOOK_LIMITS.zoomIn,LOOK_LIMITS.zoomOut);this.dirty=true;}
  reset(){this.yaw=0;this.tilt=0;this.zoom=1;this.inspecting=false;this.pan.set(0,0,0);this.dirty=true;}
  setInspecting(value){this.inspecting=value;this.pan.set(0,0,0);this.zoom=1;this.dirty=true;}
  setChainBounds(box){this.chainBox=box;if(this.inspecting)this.dirty=true;}
  // Another table shape (orientation change): only the framing changes, never the seats.
  setTable({outline,playArea,feltHalf,steepest}){Object.assign(this,{outline,playArea,felt:feltHalf,steepest:deg(steepest)});this.pan.set(0,0,0);this.dirty=true;}
  bindControls({onTap}) {
    const pointers=new Map();let lastX=0,lastY=0,pinch=0,moved=false;
    const camerasButton=e=>e.pointerType!=='mouse'||e.button===2||(this.inspecting&&e.button===0);
    const down=e=>{
      if(e.pointerType==='mouse'&&e.button===0&&!this.inspecting){this.tapPointer={id:e.pointerId,x:e.clientX,y:e.clientY};return;}
      if(!camerasButton(e))return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});lastX=e.clientX;lastY=e.clientY;moved=false;this.canvas.setPointerCapture(e.pointerId);
      if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
    };
    const move=e=>{
      if(!pointers.has(e.pointerId))return;
      const p=pointers.get(e.pointerId);p.x=e.clientX;p.y=e.clientY;
      if(pointers.size===2){const a=[...pointers.values()],next=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch)this.dolly((pinch-next)*2);pinch=next;moved=true;}
      else {if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>6)moved=true;if(moved)this.orbit(e.clientX-lastX,e.clientY-lastY);}
      lastX=e.clientX;lastY=e.clientY;e.preventDefault();
    };
    const up=e=>{
      if(this.tapPointer?.id===e.pointerId){if(e.type==='pointerup'&&Math.hypot(e.clientX-this.tapPointer.x,e.clientY-this.tapPointer.y)<8)onTap(e.clientX,e.clientY);this.tapPointer=null;return;}
      if(!pointers.has(e.pointerId))return;const count=pointers.size;pointers.delete(e.pointerId);if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);
      if(e.type==='pointerup'&&!moved&&count===1)onTap(e.clientX,e.clientY);pinch=0;
    };
    const wheel=e=>{e.preventDefault();this.dolly(e.deltaY);};
    const context=e=>e.preventDefault();const cancel=()=>{pointers.clear();pinch=0;moved=false;this.tapPointer=null;};
    const visibility=()=>{if(document.hidden)cancel();};
    const add=(target,type,fn,options)=>{target.addEventListener(type,fn,options);return()=>target.removeEventListener(type,fn,options);};
    const removers=[add(this.canvas,'contextmenu',context),add(window,'blur',cancel),add(window,'resize',cancel),add(window,'orientationchange',cancel),add(document,'visibilitychange',visibility),
      add(this.canvas,'pointerdown',down),add(this.canvas,'pointermove',move),add(this.canvas,'pointerup',up),add(this.canvas,'pointercancel',up),add(this.canvas,'lostpointercapture',up),add(this.canvas,'wheel',wheel,{passive:false})];
    this.unbind=()=>removers.forEach(r=>r());
  }
  usable(){const i=this.getInsets();return {left:i.left,right:this.width-i.right,top:i.top,bottom:this.height-i.bottom};}
  // Projects this.points with a candidate pose and returns their pixel bounding box (before view offset).
  measure(position,target) {
    const c=this.measureCamera;c.fov=FRAMING.fov;c.aspect=this.camera.aspect;c.near=.1;c.far=200;c.updateProjectionMatrix();
    c.position.copy(position);c.lookAt(target);c.updateMatrixWorld();
    const box=points=>{let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const p of points){this.scratch.copy(p).project(c);const x=(this.scratch.x+1)*this.width/2,y=(1-this.scratch.y)*this.height/2;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return {minX,maxX,minY,maxY};};
    // Width comes from this.points; height from this.vpoints when a separate vertical set is given.
    const w=box(this.points),v=this.vpoints?box(this.vpoints):w;
    return {minX:w.minX,maxX:w.maxX,minY:v.minY,maxY:v.maxY,width:w.maxX-w.minX,height:v.maxY-v.minY};
  }
  pose(pitch,yaw,distance,target,out=new THREE.Vector3()) {return out.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance).add(target);}
  // Smallest distance at which the points fit the usable box using `share` of its width.
  fitDistance(pitch,target,share) {
    const area=this.usable(),w=(area.right-area.left)*share,h=area.bottom-area.top;let lo=2,hi=150;
    for(let i=0;i<30;i++){const mid=(lo+hi)/2,b=this.measure(this.pose(pitch,0,mid,target),target);if(b.width<=w&&b.height<=h)hi=mid;else lo=mid;}
    return hi;
  }
  outlinePoints(){this.vpoints=this.playArea.map(([x,z,y])=>new THREE.Vector3(x,y,z));return this.outline.map(([x,z])=>new THREE.Vector3(x,this.topY,z));}
  overview() {
    this.points=this.outlinePoints();
    const target=new THREE.Vector3(0,this.surfaceY,0),area=this.usable();let best=null;
    for(let pitch=this.steepest;pitch>=FRAMING.flattest-1e-6;pitch-=deg(2)) {
      const distance=this.fitDistance(pitch,target,FRAMING.widthShare),share=this.measure(this.pose(pitch,0,distance,target),target).width/(area.right-area.left);
      if(!best||share>best.share+.005)best={pitch,distance,share};
      if(share>=FRAMING.widthShare-.015)break;
    }
    return {...best,target};
  }
  inspection() {
    const b=this.chainBox,m=1.25;this.vpoints=null;
    this.points=[[b.minX-m,b.minZ-m],[b.maxX+m,b.minZ-m],[b.maxX+m,b.maxZ+m],[b.minX-m,b.maxZ+m]].map(([x,z])=>new THREE.Vector3(x,this.surfaceY,z));
    const target=new THREE.Vector3((b.minX+b.maxX)/2,this.surfaceY,(b.minZ+b.maxZ)/2).add(this.pan);
    const legible=1.06*this.height/(2*Math.tan(deg(FRAMING.fov/2))*TILE_PIXELS_MIN);
    return {pitch:INSPECT_PITCH,distance:Math.min(this.fitDistance(INSPECT_PITCH,target,.94),legible),target};
  }
  solve() {
    const base=this.inspecting?this.inspection():this.overview();
    const yaw=this.inspecting?0:this.yaw,pitch=this.inspecting?base.pitch:clamp(base.pitch+this.tilt,FRAMING.flattest-.1,deg(84));
    this.distance=base.distance*this.zoom;this.desired.target.copy(base.target);this.pose(pitch,yaw,this.distance,base.target,this.desired.position);
    // Centre the fitted region inside the free band between the scoreboard and the hand.
    if(!this.inspecting)this.points=this.outlinePoints();
    const box=this.measure(this.desired.position,this.desired.target),area=this.usable();
    this.desired.offsetX=(box.minX+box.maxX)/2-(area.left+area.right)/2;this.desired.offsetY=(box.minY+box.maxY)/2-(area.top+area.bottom)/2;
    this.dirty=false;
  }
  update(dt,instant=false) {
    const insets=this.getInsets(),key=[insets.top,insets.bottom,insets.left,insets.right].map(Math.round).join();
    if(key!==this.insetKey){this.insetKey=key;this.dirty=true;}
    if(this.dirty)this.solve();
    const k=instant||this.reducedMotion?1:1-Math.exp(-dt*6);
    this.position.lerp(this.desired.position,k);this.target.lerp(this.desired.target,k);this.offsetX=lerp(this.offsetX,this.desired.offsetX,k);this.offsetY=lerp(this.offsetY,this.desired.offsetY,k);
    this.camera.fov=FRAMING.fov;this.camera.setViewOffset(this.width,this.height,this.offsetX,this.offsetY,this.width,this.height);this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.position);this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
  }
  tablePoint(clientX,clientY) {
    const r=this.canvas.getBoundingClientRect();this.ndc.set((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2);
    this.raycaster.setFromCamera(this.ndc,this.camera);return this.raycaster.ray.intersectPlane(this.floor,new THREE.Vector3());
  }
  project(point) {const p=point.clone().project(this.camera);return{x:this.left+(p.x+1)*this.width/2,y:this.top+(1-p.y)*this.height/2,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};}
}
