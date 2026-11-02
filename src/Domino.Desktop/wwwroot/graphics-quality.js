// Render budgets for the three quality preferences. Pure data: the scene applies it and nothing here
// touches the game. Pixel ratio is a ceiling; the device ratio is used when lower. Shadows do not depend on
// the camera, so the shadow map is redrawn only when a piece moves, never on a timer.
export const QUALITY=Object.freeze({
  low:Object.freeze({pixelRatio:1,reflections:false,shadows:false,shadowSize:0,softShadows:false,anisotropy:2,clearcoat:false,fps:30}),
  medium:Object.freeze({pixelRatio:1.25,reflections:true,shadows:true,shadowSize:1024,softShadows:false,anisotropy:4,clearcoat:false,fps:60}),
  high:Object.freeze({pixelRatio:2,reflections:true,shadows:true,shadowSize:2048,softShadows:true,anisotropy:8,clearcoat:true,fps:60})
});
export function qualityProfile(name,devicePixelRatio=1,maxAnisotropy=16) {
  const key=QUALITY[name]?name:'medium',p=QUALITY[key];
  return {...p,name:key,pixelRatio:Math.min(devicePixelRatio,p.pixelRatio),anisotropy:Math.min(maxAnisotropy,p.anisotropy)};
}
