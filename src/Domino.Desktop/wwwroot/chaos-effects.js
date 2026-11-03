import * as THREE from './vendor/three.module.js';
import {TABLE} from './table-model.js';
// One bounded pool, shared geometry/materials. Saved poses never touch logical state.
export class ChaosEffects {
  constructor(scene){
    this.s=scene;this.group=new THREE.Group();scene.scene.add(this.group);
    this.geo=new THREE.SphereGeometry(1,6,4);this.mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false});
    this.particles=Array.from({length:120},()=>{const m=new THREE.Mesh(this.geo,this.mat);this.group.add(m);return m;});
    this.ringGeo=new THREE.TorusGeometry(1,.035,6,64);this.ring=new THREE.Mesh(this.ringGeo,this.mat);this.ring.rotation.x=Math.PI/2;this.group.add(this.ring);
    this.group.visible=false;this.frozen=false;
    this.markMat=new THREE.MeshBasicMaterial({color:0xbdefff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    c.strokeStyle='#ffffff';c.lineWidth=2;
    for(let i=0;i<24;i++){const a=i*2.399;c.beginPath();c.moveTo(128,128);for(let j=1;j<6;j++)c.lineTo(128+Math.cos(a+j*.12)*j*22,128+Math.sin(a-j*.1)*j*22);c.stroke();}
    this.markTex=new THREE.CanvasTexture(canvas);this.markMat.map=this.markTex;this.markGeo=new THREE.PlaneGeometry(9,7);this.mark=new THREE.Mesh(this.markGeo,this.markMat);this.mark.rotation.x=-Math.PI/2;this.mark.position.y=TABLE.feltTop+.025;scene.scene.add(this.mark);
    this.crown=new THREE.Group();this.group.add(this.crown);this.crownGeo=new THREE.ConeGeometry(.15,.5,4);this.crownMat=new THREE.MeshBasicMaterial({color:0xffd34d});
    for(let i=0;i<7;i++){const m=new THREE.Mesh(this.crownGeo,this.crownMat);m.position.set(Math.cos(i*Math.PI*2/7)*.55,0,Math.sin(i*Math.PI*2/7)*.55);this.crown.add(m);}
    this.copies=new Map();this.frostGroup=new THREE.Group();scene.scene.add(this.frostGroup);this.frostNodes=new Map();
    this.boltGeo=new THREE.BufferGeometry();this.boltPoints=new Float32Array(180*3);this.boltGeo.setAttribute('position',new THREE.BufferAttribute(this.boltPoints,3));this.bolt=new THREE.Line(this.boltGeo,this.mat);this.group.add(this.bolt);
    this.dragon=new THREE.Group();this.group.add(this.dragon);
    for(const [x,y,z,sx,sy,sz] of [[0,0,0,.28,.18,.2],[.24,-.03,0,.23,.09,.13],[-.12,.16,-.12,.06,.2,.06],[-.12,.16,.12,.06,.2,.06]]){const n=new THREE.Mesh(this.geo,this.mat);n.position.set(x,y,z);n.scale.set(sx,sy,sz);this.dragon.add(n);}


  }
  play(event){
    this.cancel();this.s.finishMotion();this.event=event;this.start=this.s.time;this.duration=event.power==='break'?3.6:2.4;
    this.saved=[...this.s.tileNodes.values()].filter(n=>n.visible).map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),scale:n.scale.clone()}));
    this.originals=[];
    this.propSaved=event.power==='trancazo'?this.s.table.props.children.map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),scale:n.scale.clone()})):[];
    if(event.power==='break'){
      let copies=this.copies.get(this.s.table);
      if(!copies){copies=this.s.table.group.children.filter(n=>n.isMesh).map(n=>{const clone=n.clone();this.s.table.group.add(clone);clone.visible=false;clone.userData.chaosCopy=true;return {original:n,clone};});this.copies.set(this.s.table,copies);}
      for(const {original,clone} of copies){clone.position.copy(original.position);clone.quaternion.copy(original.quaternion);clone.visible=original.visible;this.originals.push({n:original,visible:original.visible});original.visible=false;}
    }
    if(event.power==='ice'){
      for(const n of this.frostNodes.values())n.visible=false;
      for(const x of this.saved){let frost=this.frostNodes.get(x.n);if(!frost){frost=x.n.clone(true);frost.traverse(n=>{if(n.isMesh)n.material=this.markMat;});this.frostNodes.set(x.n,frost);this.frostGroup.add(frost);}frost.position.copy(x.p);frost.quaternion.copy(x.q);frost.scale.copy(x.scale).multiplyScalar(1.006);frost.visible=true;}
    }
    this.parts=(event.power==='break'?this.copies.get(this.s.table).map(x=>x.clone):[]).map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),scale:n.scale.clone()}));
    this.center=new THREE.Vector3(0,TABLE.feltTop+.12,0);
    const target=this.s.tileNodes.get(event.a+':'+event.b);if(target)this.center.copy(target.position);
    if(event.power==='capicua')for(const x of this.saved){x.materials=[];x.n.traverse(n=>{if(n.isMesh){x.materials.push([n,n.material]);n.material=this.crownMat;}});}
    this.crown.visible=event.power==='capicua';this.group.visible=true;this.s.chaosBusy=true;
  }
  cancel(){
    for(const x of [...(this.saved??[]),...(this.parts??[]),...(this.propSaved??[])]){x.n.position.copy(x.p);x.n.quaternion.copy(x.q);x.n.scale.copy(x.scale);}
    for(const x of this.saved??[])for(const [n,m] of x.materials??[])n.material=m;
    for(const x of this.originals??[])x.n.visible=x.visible;
    for(const copies of this.copies?.values()??[])for(const x of copies)x.clone.visible=false;
    this.originals=[];this.saved=[];this.parts=[];this.propSaved=[];this.event=null;this.group.visible=false;this.s.chaosBusy=false;if(this.frostGroup)this.frostGroup.visible=this.frozen;
  }
  update(){
    if(!this.event){this.frostGroup.visible=this.frozen;this.markMat.opacity=this.frozen?.4:0;return;}
    try{
      const u=Math.min(1,(this.s.time-this.start)/this.duration),e=Math.sin(Math.PI*u),power=this.event.power;
      const reduced=this.s.reducedMotion,amp=reduced?.08:1;
      this.markMat.color.setHex(power==='ice'||power==='shatter'?0xbdefff:0x39251c);
      this.frostGroup.visible=power==='ice'||power==='shatter'||this.frozen;
      this.markMat.opacity=['ice','shatter','trancazo','meteor','fire'].includes(power)?e*.8:0;
      this.mark.scale.setScalar(power==='ice'?Math.max(.1,u):power==='meteor'||power==='fire'?.25:1);
      if(power==='meteor'||power==='fire'){this.mark.position.x=this.center.x;this.mark.position.z=this.center.z;}else{this.mark.position.x=0;this.mark.position.z=0;}
      this.crown.position.set(0,TABLE.feltTop+1.5+e*.5,0);this.crown.rotation.y=u*3;

      const colors={fire:0xff681c,meteor:0xffa038,electric:0x77deff,ice:0xbcefff,blackhole:0xa56aff,hurricane:0xb9d8db,dragon:0xaed2c4,wave:0x29c8e5,capicua:0xffd34d,break:0xdca878,slam:0xc8ab87,trancazo:0xe4ad71};
      this.bolt.visible=power==='electric';this.dragon.visible=power==='dragon';
      if(power==='electric'){
        const total=Math.min(180,Math.max(2,this.saved.length*7));this.boltGeo.setDrawRange(0,total);
        for(let i=0;i<total;i++){const tile=this.saved[Math.min(this.saved.length-1,Math.floor(i/7))];if(tile){const next=this.saved[Math.min(this.saved.length-1,Math.floor(i/7)+1)],f=(i%7)/7;this.boltPoints[i*3]=tile.p.x+(next.p.x-tile.p.x)*f;this.boltPoints[i*3+1]=tile.p.y+.2+Math.sin(i*4+u*16)*.09;this.boltPoints[i*3+2]=tile.p.z+(next.p.z-tile.p.z)*f+Math.sin(i*3+u*12)*.08;}}
        this.boltGeo.attributes.position.needsUpdate=true;this.boltGeo.computeBoundingSphere();
      }
      if(power==='dragon'&&this.saved.length){const tile=this.saved[Math.min(this.saved.length-1,Math.floor(u*this.saved.length))];this.dragon.position.copy(tile.p);this.dragon.position.y+=.55;this.dragon.rotation.y=u*5;}
      for(const x of this.propSaved??[]){x.n.position.copy(x.p);x.n.position.y+=e*.1*Math.sin(u*17);x.n.quaternion.copy(x.q);x.n.rotateZ(e*.07*Math.sin(u*15));}
      this.mat.color.setHex(colors[power]??0xe4cb8c);this.mat.opacity=e*.85;
      const count=this.s.qualityLevel==='low'?30:this.s.qualityLevel==='high'?120:64;
      this.particles.forEach((m,i)=>{
        m.visible=i<count;if(!m.visible)return;
        const a=i*2.39996+this.event.seed%61,r=.3+(i%17)/17*4.8;
        let x=Math.cos(a)*r,z=Math.sin(a)*r,y=.05;
        if(power==='hurricane'||power==='blackhole'){const spin=a+u*12;x=Math.cos(spin)*r*e;z=Math.sin(spin)*r*e;y=(i%19)/6*e;}
        else if(power==='fire'||power==='meteor'){x=this.center.x+Math.cos(a)*e*(i%9)/9;z=this.center.z+Math.sin(a)*e*(i%9)/9;y=(i%13)/5*e+(power==='meteor'?(1-u)*6:0);}
        else if(power==='wave'){x=u*14-7+(i%6)*.15;z=(i/count-.5)*10;y=Math.sin(i*.4+u*9)*.35*e;}
        else if(power==='electric'){const tile=this.saved[i%Math.max(1,this.saved.length)];if(tile){x=tile.p.x+Math.sin(i*8+u*18)*.15;z=tile.p.z;y=.2+(i%5)*.09;m.scale.set(.025,.18,.025);}}
        else if(power==='dragon'){const j=Math.floor((u+i/count*.2)*this.saved.length)%Math.max(1,this.saved.length),tile=this.saved[j];if(tile){x=tile.p.x+Math.sin(a+u*8)*.35;z=tile.p.z+Math.cos(a)*.25;y=.35+Math.sin(u*7+i*.1)*.25;}}
        else if(power==='capicua'){x=Math.cos(a)*r;z=Math.sin(a)*r;y=3*(1-u)+(i%9)/5;}
        else if(power==='ice'){y=.025;x*=u;z*=u;}
        else {x*=u*1.8;z*=u*1.8;y=Math.max(0,Math.sin(u*Math.PI)*(i%9)/8);}
        m.position.set(x,TABLE.feltTop+y,z);if(power!=='electric')m.scale.setScalar((power==='dragon'?.18:power==='ice'?.065:.045)*e);
      });
      this.ring.position.copy(this.center);this.ring.scale.setScalar(power==='blackhole'?1.8*e:.2+u*7);this.ring.visible=!['dragon','electric','fire'].includes(power);
      this.saved.forEach((x,i)=>{
        x.n.position.copy(x.p);x.n.quaternion.copy(x.q);x.n.scale.copy(x.scale);
        if(power==='hurricane'||power==='blackhole'){
          const a=u*Math.PI*4*amp,r=power==='blackhole'?1-e*.95*amp:1;
          x.n.position.set((x.p.x*Math.cos(a)-x.p.z*Math.sin(a))*r,x.p.y+e*(1.4+i%3*.3)*amp,(x.p.x*Math.sin(a)+x.p.z*Math.cos(a))*r);x.n.rotateY(a*amp);
          if(power==='blackhole')x.n.scale.multiplyScalar(1-e*.8);
        }else if(power==='break'){x.n.position.y+=e*(1+i%4*.2)*amp;x.n.rotateZ(e*(i%2?1:-1)*.35*amp);}
        else if(power==='wave'){x.n.position.y+=Math.max(0,1-Math.abs(x.p.x-(u*14-7)))*e*.8*amp;x.n.position.z+=Math.sin(u*Math.PI*2)*e*.3*amp;}
        else if(power==='slam'||power==='trancazo'){x.n.position.y+=Math.abs(Math.sin(u*10-i*.3))*e*.35*amp;}
        else if((power==='meteor'||power==='fire')&&x.n===this.s.tileNodes.get(this.event.a+':'+this.event.b)){x.n.position.y+=(power==='meteor'?Math.pow(1-u,4)*6:e*.35)*amp;x.n.rotateY(e*.3*amp);}
      });
      if(power==='break')this.parts.forEach((x,i)=>{x.n.position.copy(x.p);x.n.position.x+=Math.sin(i*3)*e*1.3*amp;x.n.position.z+=Math.cos(i*3)*e*1.3*amp;x.n.position.y-=e*.4*amp;x.n.quaternion.copy(x.q);x.n.rotateZ(Math.sin(i)*e*.15*amp);});
      if(u>=1){this.frozen=power==='ice';if(power==='shatter')this.frozen=false;this.cancel();this.s.onSettled?.();}
    }catch(error){console.warn('Efecto restaurado',error);this.cancel();this.s.onSettled?.();}
  }
  dispose(){this.cancel();this.group.removeFromParent();this.geo.dispose();this.boltGeo.dispose();this.ringGeo.dispose();this.mat.dispose();this.frostGroup.removeFromParent();this.mark.removeFromParent();this.markGeo.dispose();this.markMat.dispose();this.markTex.dispose();this.crownGeo.dispose();this.crownMat.dispose();for(const copies of this.copies.values())for(const x of copies)x.clone.removeFromParent();}
}
