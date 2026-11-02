import * as THREE from './vendor/three.module.js';
import {RoomEnvironment} from './vendor/environments/RoomEnvironment.js';

// Colour pipeline and lights. A prefiltered room environment (generated on the GPU, no download)
// gives the table and tiles soft reflections. It is applied per material, not scene-wide: sampling it
// on the distant scenery halved the frame rate in measurements for no visible gain. Never a background.
export class TableLighting {
  constructor(renderer,scene) {
    this.renderer=renderer;this.scene=scene;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    // Neutral keeps ivory white and felt green instead of the orange shift of filmic curves.
    renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();

    this.group=new THREE.Group();scene.add(this.group);
    // Warm sky above, terracotta bounce from the floor.
    this.group.add(new THREE.HemisphereLight('#ffe9cc','#5a3a26',.85));
    // Late-afternoon sun from the sea side, high enough to keep tile shadows short and readable.
    const key=new THREE.DirectionalLight('#ffd7a6',3);key.position.set(-6.5,15,-7);key.castShadow=true;
    Object.assign(key.shadow.camera,{left:-8.5,right:8.5,top:8.5,bottom:-8.5,near:4,far:36});key.shadow.bias=-.0004;key.shadow.normalBias=.018;key.shadow.radius=3;
    // Sky light still reaches shaded felt: a full-strength shadow would read as a hole.
    key.shadow.intensity=.72;
    this.group.add(key,key.target);key.target.position.set(0,2,0);this.key=key;
    // Soft fill from the player's side so faces toward the camera never go muddy.
    const fill=new THREE.DirectionalLight('#fff0dc',.9);fill.position.set(1.5,10,12);this.group.add(fill);
    for(const x of [-11.2,11.2]){const lantern=new THREE.PointLight('#ffb35c',5,16,2);lantern.position.set(x,6,-4);this.group.add(lantern);}
  }
  reflect(materials,intensity=.55){this.reflective=materials.filter(m=>!m.isMeshBasicMaterial);for(const m of this.reflective){m.envMap=this.environment;m.envMapIntensity=intensity;m.needsUpdate=true;}}
  applyQuality(profile) {
    const shadowMap=this.renderer.shadowMap,type=profile.softShadows?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
    const changed=shadowMap.enabled!==profile.shadows||shadowMap.type!==type;
    // Without reflections the hemisphere and fill lights still shape every surface: the light fallback.
    for(const m of this.reflective??[]){const map=profile.reflections?this.environment:null;if(m.envMap!==map){m.envMap=map;m.needsUpdate=true;}}
    shadowMap.enabled=profile.shadows;shadowMap.type=type;this.key.castShadow=profile.shadows;
    if(profile.shadows&&this.key.shadow.mapSize.x!==profile.shadowSize){this.key.shadow.map?.dispose();this.key.shadow.map=null;this.key.shadow.mapSize.set(profile.shadowSize,profile.shadowSize);}
    // Shadow settings are compiled into every lit shader.
    if(changed)this.scene.traverse(o=>{for(const m of [o.material].flat())if(m)m.needsUpdate=true;});
    shadowMap.needsUpdate=true;
  }
  dispose(){this.environment.dispose();this.key.shadow.map?.dispose();this.group.removeFromParent();}
}
