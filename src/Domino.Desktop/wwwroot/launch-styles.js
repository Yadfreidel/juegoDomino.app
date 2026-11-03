// Presentation of an accepted move: how a tile travels from its owner's side to the pose the rules
// already decided. Pure functions, no physics: every style ends exactly on the target position and angle.
export const LAUNCH_STYLES=Object.freeze({
  // Short arc, controlled descent, gentle settle.
  suave:{label:'Suave',duration:.5,height:.32,spins:0,sound:'soft',vibrate:0},
  // Firm drop: quick, accelerating fall and a tiny rebound. Sound and optional vibration mark the impact.
  golpe:{label:'Golpe',duration:.36,height:.6,spins:0,sound:'slam',vibrate:22},
  // A brief turn during the flight, aligned exactly on landing.
  giro:{label:'Giro',duration:.55,height:.4,spins:1,sound:'soft',vibrate:0},
  // Close to the felt, decelerating naturally.
  deslizar:{label:'Deslizar',duration:.6,height:.03,spins:0,sound:'slide',vibrate:0}
});
export const DEFAULT_LAUNCH='suave';
export function launchStyle(name){return LAUNCH_STYLES[name]?name:DEFAULT_LAUNCH;}

const smooth=t=>t*t*(3-2*t),easeOut=t=>1-(1-t)**3,easeIn=t=>t*t*t;
// Pose at progress t (0..1) as offsets: f = share of the path covered, lift = height above the line,
// turn = extra rotation added to the interpolated angle. At t=1: f=1, lift=0, turn=0 for every style.
export function launchFrame(name,t) {
  const s=LAUNCH_STYLES[launchStyle(name)],p=Math.min(1,Math.max(0,t));
  if(name==='golpe') {
    // Rises fast, then falls with acceleration; a 2 mm rebound in the last 15 %.
    const f=easeOut(Math.min(1,p/.85)),fall=p<.45?Math.sin(p/.45*Math.PI/2):1-easeIn((p-.45)/.55);
    const rebound=p>.85?Math.sin((p-.85)/.15*Math.PI)*.02:0;
    return {f,lift:p<1?Math.max(0,fall)*s.height+rebound:0,turn:0};
  }
  if(name==='deslizar')return {f:easeOut(p),lift:p<1?s.height*(1-p):0,turn:0};
  const f=name==='giro'?smooth(p):easeOut(p);
  return {f,lift:p<1?Math.sin(p*Math.PI)*s.height*(name==='suave'?1-.35*p:1):0,turn:p<1?(1-smooth(p))*s.spins*Math.PI*2:0};
}
